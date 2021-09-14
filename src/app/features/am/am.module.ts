import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmComponent } from './am.component';
import { SharedModule } from '../../shared/shared.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {MatFormFieldModule} from '@angular/material/form-field';


@NgModule({
  declarations: [AmComponent],
  imports: [CommonModule, SharedModule, FontAwesomeModule,MatFormFieldModule]
})
export class AmModule {}
