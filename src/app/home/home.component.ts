import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as electron from 'electron'
import { ElectronService } from "../core/services";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  availableRelays = []

  constructor(
    private router: Router,
    private electronService: ElectronService
  ) { }

  ngOnInit(): void { }

  openDoor(slot) {
    console.log(this.electronService.ipcRenderer.sendSync('switchActiveRelayOn', slot))

    setTimeout(() => {
      this.electronService.ipcRenderer.sendSync('switchActiveRelayOff', slot)
    }, 5000);
  }

  searchRelays() {
    this.availableRelays = this.electronService.ipcRenderer.sendSync('findRelays')
    console.log(this.electronService.ipcRenderer.sendSync('findRelays'))
  }

  setRelay(index) {

    console.log(this.electronService.ipcRenderer.sendSync('setActiveRelay', this.availableRelays[index].path))
  }

}
