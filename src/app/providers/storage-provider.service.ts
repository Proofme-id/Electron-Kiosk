import { Injectable } from "@angular/core";
import { ElectronService } from "../core/services";

@Injectable()
export class StorageProvider {

  constructor(
    private electronService: ElectronService
  ) {
  }

  getKey(key: string): any {
      return this.electronService.ipcRenderer.sendSync('getKey', key)
  }

  setKey(key: string, value: any): void {
    const update = { key, value };
    return this.electronService.ipcRenderer.sendSync('setKey', update)
  }

  hasKey(key: string): boolean {
    return this.electronService.ipcRenderer.sendSync('hasKey', key)
  }

  deleteKey(key: string): string {
    return this.electronService.ipcRenderer.sendSync('deleteKey', key)
  }
}
