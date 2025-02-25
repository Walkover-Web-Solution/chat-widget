import { envVariables } from './env-variables';
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: true,
    server: 'https://control.msg91.com',
    env: 'prod',
    basePath: '',
    ...envVariables,
};
