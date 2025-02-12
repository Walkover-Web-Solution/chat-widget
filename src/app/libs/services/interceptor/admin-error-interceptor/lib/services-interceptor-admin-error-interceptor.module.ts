import { NgModule, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandler,
    HttpInterceptor,
    HttpRequest,
    HttpResponse,
} from '@angular/common/http';
import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { PrimeNgToastService } from '@msg91/ui/prime-ng-toast';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { CookieService } from 'ngx-cookie-service';

@NgModule({
    imports: [CommonModule],
})
export class ServicesAdminErrorInterceptorModule {}

@Injectable({
    providedIn: ServicesAdminErrorInterceptorModule,
})
export class AdminErrorInterceptor implements HttpInterceptor {
    constructor(
        private router: Router,
        private afAuth: AngularFireAuth,
        private toast: PrimeNgToastService,
        private cookieService: CookieService
    ) {}

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (request.url.includes('api/admin/login') || this.cookieService.get('authToken')) {
            return next.handle(request).pipe(
                tap((resp: HttpResponse<any>) => {
                    if (
                        resp.type &&
                        resp.body &&
                        resp.body['errors'] &&
                        resp.body['errors'].length &&
                        resp.body['errors'][0] &&
                        resp.body['errors'][0].title === '503'
                    ) {
                        //  this.router.navigate(['under-maintenance']);
                    }
                }),
                catchError((err) => {
                    if (err instanceof HttpErrorResponse) {
                        if (err.status === 401) {
                            this.cookieService.delete('authToken', '/');
                            if (err.error?.errors?.length) {
                                this.toast.error(
                                    typeof err.error?.errors === 'string' ? err.error?.errors : err.error?.errors[0]
                                );
                            } else {
                                this.toast.error('Session expired');
                            }
                            this.afAuth.signOut();
                            this.router.navigate(['/']);
                            return throwError(err.error);
                        }
                        if (err.status === 422) {
                            return throwError(err.error);
                        }
                        if (err.status === 500) {
                            return throwError({
                                errors: err.error?.errors?.length ? err?.error.errors : 'Internal server error',
                                hasError: true,
                            });
                        }
                        if (err.status === 403) {
                            if (err.error?.redirection !== false) {
                                this.router.navigate(['/m', 'l', 'admin', 'admin-dashboard']);
                            }
                            return throwError({
                                errors: err.error?.errors ?? err.error,
                                hasError: true,
                                errorCode: err.status,
                            });
                        }
                        if (err.status === 400 || err.status === 429) {
                            return throwError({
                                errors: err.error?.errors || err.error?.error || err.error,
                                hasError: true,
                                errorCode: err.status,
                            });
                        }
                        if (err.status === 404) {
                            if (typeof err.error === 'string' || err.error instanceof String) {
                                return throwError({
                                    errors: err.error?.length ? err?.error : 'Internal server error',
                                    hasError: true,
                                });
                            } else if (typeof err.error === 'object' || err.error instanceof Object) {
                                return throwError({
                                    errors: err.error?.errors ?? err.error,
                                    hasError: true,
                                    data: err.error?.data,
                                    status: err.error?.status,
                                });
                            }
                            return throwError({ ...err.error, hasError: true });
                        }
                        return throwError(err);
                    }
                })
            );
        }
        return EMPTY;
    }
}
