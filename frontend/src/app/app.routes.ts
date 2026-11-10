import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicGuard } from './core/guards/public.guard';
import { adminGuard } from './core/guards/admin.guard';
import path from 'path';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () => import('./features/auth/login/login'),
  },
  {
    path: 'recuperar-password',
    canActivate: [publicGuard],
    loadComponent: () => import('./features/auth/recuperar-password/recuperar-password')
  },
  {
    path: 'restablecer',
    loadComponent: () => import('./features/auth/restablecer-password/restablecer-password')
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell'),
    children: [
      {
        path: 'clientes',
        loadComponent: () => import('./features/clientes/clientes-list/clientes-list'),
      },
      {
        path: 'clientes/nuevo',
        loadComponent: () => import('./features/clientes/cliente-nuevo/cliente-nuevo'),
      },
      {
        path: 'clientes/:id',
        loadComponent: () => import('./features/clientes/cliente-detalle/cliente-detalle'),
      },
      {
        path: 'productos',
        loadComponent: () => import('./features/productos/productos-list/productos-list'),
      },
      {
        path: 'productos/nuevo',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/productos/producto-nuevo/producto-nuevo'),
      },
      {
        path: 'productos/movimientos',
        loadComponent: () => import('./features/productos/movimientos-stock-list/movimientos-stock-list')
      },
      {
        path: 'productos/:id',
        loadComponent: () => import('./features/productos/producto-detalle/producto-detalle'),
      },
      {
        path: 'clientes/:clienteId/entrega',
        loadComponent: () => import('./features/historial/entrega-nueva/entrega-nueva'),
      },
      {
        path: 'historial',
        loadComponent: () => import('./features/historial/historial-list/historial-list'),
      },
      {
        path: 'clientes/:id/historial',
        loadComponent: () => import('./features/clientes/cliente-historial/cliente-historial'),
      },
      {
        path: 'barrios',
        loadComponent: () => import('./features/barrios/barrios-list/barrios-list'),
      },
      {
        path: 'usuarios/nuevo',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/usuarios/usuario-nuevo/usuario-nuevo')
      },
      {
        path: 'hoy',
        loadComponent: () => import('./features/hoy/hoy-home/hoy-home')
      },
      { path: '', redirectTo: 'hoy', pathMatch: 'full' },
      { path: '**', loadComponent: () => import('./shared/not-found/not-found') },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
