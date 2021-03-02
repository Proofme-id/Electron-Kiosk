import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AmComponent } from "./features/am/am.component";
import { ConfigComponent } from "./features/config/config.component";
import { HomeComponent } from "./features/home/home.component";
import { PageNotFoundComponent } from './shared/components';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },{
    path: 'home',
    component: HomeComponent
  },{
    path: 'config',
    component: ConfigComponent
  },{
    path: 'am',
    component: AmComponent
  },
  {
    path: '**',
    component: PageNotFoundComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
