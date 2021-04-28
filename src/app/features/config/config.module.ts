import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { ConfigComponent } from './config.component';
import { NgxSelectModule } from 'ngx-select-ex';
import { SelectDropDownModule } from 'ngx-select-dropdown'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import {MatToolbarModule} from '@angular/material/toolbar';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxFlagPickerModule } from 'ngx-flag-picker';
import { NgxCheckboxModule } from 'ngx-checkbox';
import { UiSwitchModule } from 'ngx-ui-switch';
import { MatPaginatorModule } from '@angular/material/paginator';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatTableModule} from '@angular/material/table';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatFormFieldModule} from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import {MatInputModule} from '@angular/material/input';

@NgModule({ 
  declarations: [ConfigComponent],
  imports: [CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatDatepickerModule,
    BrowserAnimationsModule,
    MatPaginatorModule,
    MatTableModule,
    SharedModule,
    UiSwitchModule,
    NgxSelectModule,
    SelectDropDownModule,
    NgbModule,
    MatToolbarModule,
    FontAwesomeModule,
    NgxFlagPickerModule,
    NgxCheckboxModule]
})
export class ConfigModule {}
