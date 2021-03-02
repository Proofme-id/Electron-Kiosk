import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from "@angular/router";

import { TranslateModule } from '@ngx-translate/core';
import { AppRoutingModule } from "../app-routing.module";

import { InstructionOverlayComponent, PageNotFoundComponent } from './components/';
import { WebviewDirective } from './directives/';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [PageNotFoundComponent, InstructionOverlayComponent, WebviewDirective],
  imports: [CommonModule, TranslateModule, FormsModule, RouterModule],
    exports: [TranslateModule, WebviewDirective, FormsModule, AppRoutingModule, InstructionOverlayComponent]
})
export class SharedModule {}
