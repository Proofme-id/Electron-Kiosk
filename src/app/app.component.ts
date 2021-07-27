import { DOCUMENT } from "@angular/common";
import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { ElectronService } from './core/services';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';
import { StorageProvider } from './providers/storage-provider.service';
import { AppStateFacade } from "./state/app/app.facade";
import { ToastrService } from "ngx-toastr";
import { takeUntil } from "rxjs/operators";
import { BaseComponent } from "./shared/components";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent extends BaseComponent implements OnInit {
  async ngOnInit(): Promise<void> {

    this.appStateFacade.message$.pipe(takeUntil(this.destroy$)).subscribe((message) => {
        if (message) {
            if (message.type === "SUCCESS") {
                this.toastr.success(message.message);
            } else if (message.type === "WARNING") {
                this.toastr.warning(message.message);
            } else if (message.type === "ERROR") {
                this.toastr.error(message.message);
            }else {
                this.toastr.info(message.message);
            }
        }
    });
  }

  constructor(
    private appStateFacade: AppStateFacade,
    private electronService: ElectronService,
    private translate: TranslateService,
    private StorageProvider: StorageProvider,
    private toastr: ToastrService,
    @Inject(LOCALE_ID) locale: string,
    @Inject(DOCUMENT) private document: Document
  ) {
    super();
    
    if (this.StorageProvider.getKey('language')) {
      this.translate.setDefaultLang(this.StorageProvider.getKey('language'));
      this.translate.use(this.StorageProvider.getKey('language'));
    }
    else
    {
      this.translate.setDefaultLang('en');
      this.translate.use('en');      
    }

    this.document.documentElement.lang = 'en';
    console.log('AppConfig', AppConfig);

    if (electronService.isElectron) {
      console.log(process.env);
      console.log('Run in electron');
      console.log('Electron ipcRenderer', this.electronService.ipcRenderer);
      console.log('NodeJS childProcess', this.electronService.childProcess);
    } else {
      console.log('Run in browser');
    }
  }

  
}
