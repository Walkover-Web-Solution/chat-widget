import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { QueryBuilderComponent } from './query-builder/query-builder.component';

import { QueryArrowIconDirective } from './query-builder/query-arrow-icon.directive';
import { QueryFieldDirective } from './query-builder/query-field.directive';
import { QueryInputDirective } from './query-builder/query-input.directive';
import { QueryEntityDirective } from './query-builder/query-entity.directive';
import { QueryOperatorDirective } from './query-builder/query-operator.directive';
import { QueryButtonGroupDirective } from './query-builder/query-button-group.directive';
import { QuerySwitchGroupDirective } from './query-builder/query-switch-group.directive';
import { QueryRemoveButtonDirective } from './query-builder/query-remove-button.directive';
import { QueryEmptyWarningDirective } from './query-builder/query-empty-warning.directive';
import { QueryAdditionalButtonDirective } from './query-builder/query-additional-button.directive';
import { PipesFieldValuePipeModule } from '@msg91/pipes/FieldValuePipe';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@NgModule({
    imports: [CommonModule, FormsModule, PipesFieldValuePipeModule, MatIconModule, MatButtonModule, MatTooltipModule],
    declarations: [
        QueryBuilderComponent,
        QueryInputDirective,
        QueryOperatorDirective,
        QueryFieldDirective,
        QueryEntityDirective,
        QueryButtonGroupDirective,
        QuerySwitchGroupDirective,
        QueryRemoveButtonDirective,
        QueryEmptyWarningDirective,
        QueryArrowIconDirective,
        QueryAdditionalButtonDirective,
    ],
    exports: [
        QueryBuilderComponent,
        QueryInputDirective,
        QueryOperatorDirective,
        QueryFieldDirective,
        QueryEntityDirective,
        QueryButtonGroupDirective,
        QuerySwitchGroupDirective,
        QueryRemoveButtonDirective,
        QueryEmptyWarningDirective,
        QueryArrowIconDirective,
        QueryAdditionalButtonDirective,
    ],
})
export class QueryBuilderModule {}
