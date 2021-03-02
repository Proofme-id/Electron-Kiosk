import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmComponent } from './am.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [AmComponent],
  imports: [CommonModule, SharedModule]
})
export class AmModule {}
