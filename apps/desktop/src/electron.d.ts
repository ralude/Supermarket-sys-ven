declare module 'electron' {
  export const app: {
    whenReady(): Promise<void>;
    on(event: 'activate' | 'window-all-closed', listener: () => void): void;
    quit(): void;
  };

  export class BrowserWindow {
    constructor(options: {
      title: string;
      width: number;
      height: number;
      minWidth: number;
      minHeight: number;
      webPreferences: {
        contextIsolation: boolean;
        nodeIntegration: boolean;
        sandbox: boolean;
        preload: string;
      };
    });
    static getAllWindows(): BrowserWindow[];
    loadURL(url: string): Promise<void>;
    loadFile(path: string): Promise<void>;
  }

  export const contextBridge: {
    exposeInMainWorld(name: string, api: unknown): void;
  };
}
