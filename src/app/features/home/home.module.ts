import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgxFlagPickerModule } from 'ngx-flag-picker';
import { SharedModule } from '../../shared/shared.module';
import { HomeComponent } from './home.component';

@NgModule({
  declarations: [HomeComponent],
  imports: [CommonModule, SharedModule, NgxFlagPickerModule]
})
export class HomeModule {}
