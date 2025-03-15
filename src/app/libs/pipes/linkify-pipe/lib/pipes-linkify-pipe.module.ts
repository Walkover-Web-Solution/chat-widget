import { ModuleWithProviders, NgModule, Pipe, PipeTransform } from '@angular/core';
import linkifyHtml from 'linkifyjs/html';

@Pipe({
    name: 'linkify',
    standalone: false
})
export class LinkifyPipe implements PipeTransform {
    transform(str: any): any {
        return str
            ? linkifyHtml(str, {
                  className: 'linkified',
                  target: {
                      url: '_blank',
                  },
              })
            : str;
    }
}

@NgModule({
    imports: [],
    declarations: [LinkifyPipe],
    exports: [LinkifyPipe],
})
export class PipesLinkifyPipeModule {
    public static forRoot(): ModuleWithProviders<PipesLinkifyPipeModule> {
        return {
            ngModule: PipesLinkifyPipeModule,
            providers: [LinkifyPipe],
        };
    }
}
