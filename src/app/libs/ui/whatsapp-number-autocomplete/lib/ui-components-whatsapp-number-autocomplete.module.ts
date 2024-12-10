import { MatTooltipModule } from '@angular/material/tooltip';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { UiVirtualScrollModule } from '@msg91/ui/virtual-scroll';
import { MatSelectModule } from '@angular/material/select';
import { WhatsAppNumberAutocompleteComponent } from './whatsapp-number-autocomplete/whatsapp-number-autocomplete.component';
import { DirectivesAutoSelectDropdownModule } from '@msg91/directives/auto-select-dropdown';
import { DirectivesLoaderButtonModule } from '@msg91/directives/loader-button';
import { DirectivesCloseDropdownOnEscapeModule } from '@msg91/directives/close-dropdown-on-escape';

@NgModule({
    imports: [
        CommonModule,
        MatInputModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatAutocompleteModule,
        MatIconModule,
        MatButtonModule,
        UiVirtualScrollModule,
        MatSelectModule,
        MatTooltipModule,
        DirectivesLoaderButtonModule,
        DirectivesAutoSelectDropdownModule,
        DirectivesCloseDropdownOnEscapeModule,
    ],
    declarations: [WhatsAppNumberAutocompleteComponent],
    exports: [WhatsAppNumberAutocompleteComponent],
})
export class UiComponentsWhatsappNumberAutocompleteModule {}
