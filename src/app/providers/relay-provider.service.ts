import { Injectable } from "@angular/core";
import { Device } from "node-hid";
import { ElectronService } from "../core/services";

@Injectable({
  providedIn: 'root'
})
export class RelayProvider {

    relays: Device[] = [];

    constructor(
        private electronService: ElectronService
    ) {
        this.relays = this.electronService.ipcRenderer.sendSync('findRelays')
    }

    switchSlot(slot: number, timeOut: number): string {
        console.log(this.electronService.ipcRenderer.sendSync('switchActiveRelayOn', slot))

        setTimeout(() => {
            this.electronService.ipcRenderer.sendSync('switchActiveRelayOff', slot)
        }, timeOut);

        return 'ok';
    }

    searchRelays(): Device[] {
        this.relays = this.electronService.ipcRenderer.sendSync('findRelays')
        return this.relays;
    }

    setActiveRelay(index: number): string {
        return this.electronService.ipcRenderer.sendSync('setActiveRelay', this.relays[index].path)
    }

}
