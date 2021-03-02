import { Injectable } from "@angular/core";
import { ElectronService } from "../core/services";

@Injectable()
export class StorageProvider {

  constructor(
    private electronService: ElectronService
  ) {
  }

  getKey(key: string): string {
      return this.electronService.ipcRenderer.sendSync('getKey', key)
  }

  setKey(key: string, value: string): void {
    const update = { key, value };
    return this.electronService.ipcRenderer.sendSync('setKey', update)
  }

  hasKey(key: string): boolean {
    return this.electronService.ipcRenderer.sendSync('hasKey', key)
  }
}
