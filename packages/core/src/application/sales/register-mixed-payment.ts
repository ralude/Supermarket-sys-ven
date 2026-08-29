import {
  ApplicationError,
  DomainError,
  err,
  Money,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { CurrencyConverter } from '../../domain/currency/index.js';
import { Payment } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  Clock,
  ExchangeRateRepository,
  FinancialTransactionTaxPolicyProvider,
  IdGenerator,
  PaymentMethodRepository,
  SaleRepository,
  BusinessEventStore,
  UnitOfWork
} from '../ports/index.js';
import type { RegisterMixedPaymentInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class RegisterMixedPayment {
  constructor(
    private readonly repository: SaleRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly exchangeRateRepository: ExchangeRateRepository,
    private readonly taxPolicyProvider: FinancialTransactionTaxPolicyProvider,
    private readonly paymentIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore
  ) {}

  async execute(input: RegisterMixedPaymentInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      const at = this.clock.now();
      const payments: Payment[] = [];

      for (const paymentInput of input.payments) {
        const method = await this.paymentMethodRepository.findByCode(paymentInput.methodCode.trim().toUpperCase());
        if (method === null) return err(new ApplicationError('PAYMENT_METHOD_NOT_FOUND', 'Payment method was not found.'));
        if (!method.isActive) return err(new ApplicationError('PAYMENT_METHOD_INACTIVE', 'Payment method is inactive.'));

        const amount = Money.fromMinorUnits(paymentInput.amountMinorUnits, paymentInput.currencyCode);
        let amountInSaleCurrency = amount;
        let exchangeRate = null;
        if (amount.currency !== sale.currencyCode) {
          if (paymentInput.exchangeRateId === undefined) {
            return err(new ApplicationError('EXCHANGE_RATE_REQUIRED', 'An explicit exchange rate is required.'));
          }
          exchangeRate = await this.exchangeRateRepository.findById(paymentInput.exchangeRateId);
          if (exchangeRate === null) return err(new ApplicationError('EXCHANGE_RATE_NOT_FOUND', 'Exchange rate was not found.'));
          amountInSaleCurrency = new CurrencyConverter().convert(amount, exchangeRate, at);
          if (amountInSaleCurrency.currency !== sale.currencyCode) {
            return err(new ApplicationError('EXCHANGE_RATE_MISMATCH', 'Exchange rate does not target sale currency.'));
          }
        }
        payments.push(Payment.create({
          id: this.paymentIdGenerator.generate(),
          method,
          amount,
          amountInSaleCurrency,
          exchangeRate,
          registeredBy: context.actorId,
          registeredAt: at
        }));
      }

      const policy = await this.taxPolicyProvider.getPolicy();
      const eligibleAmount = payments.reduce((total, payment) => {
        const eligible = policy.eligiblePaymentMethodCodes.includes(payment.method.code) &&
          policy.eligibleCurrencies.includes(payment.amount.currency);
        return eligible ? total.add(payment.amountInSaleCurrency) : total;
      }, Money.zero(sale.currencyCode));
      const taxableEligibleAmount = eligibleAmount.minorUnits > sale.commercialTotal.minorUnits
        ? sale.commercialTotal
        : eligibleAmount;
      const financialTransactionTax = policy.rate.applyTo(taxableEligibleAmount);

      sale.registerPayments({
        payments,
        financialTransactionTax,
        occurredAt: at,
        eventIds: payments.map(() => this.eventIdGenerator.generate())
      });
      await persistBusinessChange(
        () => this.repository.save(sale), sale.domainEvents, context,
        this.unitOfWork, this.eventStore
      );
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
