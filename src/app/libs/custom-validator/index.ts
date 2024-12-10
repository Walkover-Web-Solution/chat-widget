import {
    AbstractControl,
    AsyncValidatorFn,
    FormControl,
    FormGroup,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';
import { MaxUserOverusageLimit } from '../constant';
import {
    NON_LATIN_UNICODE_REGEX,
    START_WITH_ALPHABET,
    CONTENT_BETWEEEN_HASH_TAG_REGEX,
    NON_ASCII_PRINTABLE_CHARACTERS_REGEX,
    CONTENT_BETWEEEN_CURLY_HASH_TAG_REGEX,
    SMS_TEMPLATE_UNICODE_REGEX,
} from '../regex';
import { getInvalidEmailVariables, maxVariableLengthCheck, minVariableLengthCheck } from '../utils';
import { cloneDeep } from 'lodash-es';
import { BehaviorSubject, Observable, of } from 'rxjs';

export class CustomValidators {
    public static multipleEmailValidator(control: AbstractControl): { [key: string]: boolean } | null {
        if (!control || (control && !control.value)) {
            return null;
        }
        const emails = (control.value || '').split(',');
        const forbidden = emails.some((email: any) => Validators.email(new FormControl(email)));
        return forbidden ? { multipleemails: true } : null;
    }

    public static containsOnlyVariables(control: AbstractControl): { [key: string]: boolean } | null {
        if (!control || (control && !control.value)) {
            return null;
        }
        let newContent = cloneDeep(control.value || '');
        let matchContent = newContent.match(CONTENT_BETWEEEN_HASH_TAG_REGEX);
        if (!matchContent) {
            return null;
        }
        while (matchContent) {
            newContent = newContent.replace(CONTENT_BETWEEEN_HASH_TAG_REGEX, '');
            matchContent = newContent.match(CONTENT_BETWEEEN_HASH_TAG_REGEX);
        }
        return !newContent.trim().length ? { containsOnlyVariables: true } : null;
    }

    public static emailVariableCheck(
        control: FormControl<string>
    ): { [s: string]: { invalidVar?: string[]; errorMessage: string } } | null {
        let invalidVar = [];
        // Will allow ####, and will not consider it as variable
        // if (!minVariableLengthCheck(control?.value)) {
        //     return {
        //         emailVariableCheck: {
        //             errorMessage: '#### is not allowed, Variable must contain atleast one character',
        //         },
        //     };
        // }
        invalidVar = getInvalidEmailVariables(control?.value);
        if (invalidVar.length) {
            return {
                emailVariableCheck: {
                    invalidVar,
                    errorMessage:
                        'Variables must contain only alphanumeric, dashes, underscores and must start with alphabet only',
                },
            };
        }
        invalidVar = maxVariableLengthCheck(control?.value);
        if (invalidVar.length) {
            return {
                emailVariableCheck: {
                    invalidVar,
                    errorMessage: 'Variables must not contain more than 32 characters',
                },
            };
        }
        return null;
    }

    public static noWhitespaceValidator(control: AbstractControl): { [key: string]: any } | null {
        const controlValue = typeof control.value !== 'string' ? String(control.value) : control.value;
        const isEmpty = (controlValue || '').length === 0;
        const isWhitespace = (controlValue || '').trim().length === 0;
        const isNewLines = (controlValue || '').replace(/^\n+|\n+$/g, '').length === 0;
        const isValid = !isWhitespace && !isNewLines;
        return isValid || isEmpty ? null : { whitespace: 'value is only whitespace' };
    }

    public static noStartEndDashValidator(control: AbstractControl): { [key: string]: any } | null {
        const controlValue = typeof control.value !== 'string' ? String(control.value) : control.value;
        const isEmpty = (controlValue || '').length === 0;
        const isValid =
            controlValue.length && controlValue[0] !== '-' && controlValue[controlValue.length - 1] !== '-'
                ? true
                : false;
        return isValid || isEmpty ? null : { noStartEndDashValidator: true };
    }

    public static passwordsMatch(group: FormGroup, formControlName: string) {
        return (control: FormControl): { [s: string]: boolean } | null => {
            if (control.value && group && group.controls[formControlName].value === control.value) {
                return null;
            }
            return { mismatch: true };
        };
    }

    public static passwordsMatchWithConfirm(group: FormGroup, formControlName: string) {
        return (control: FormControl): { [s: string]: boolean } => {
            if (control.value && group && group.controls[formControlName].value === control.value) {
                return { mismatchwithconfirm: false };
            }
            return { mismatchwithconfirm: true };
        };
    }

    // custom validator to check that two fields match
    public static MustMatch(controlName: string, matchingControlName: string) {
        return (formGroup: FormGroup) => {
            const control = formGroup.controls[controlName];
            const matchingControl = formGroup.controls[matchingControlName];

            if (matchingControl.errors && !matchingControl.errors['mustMatch']) {
                // return if another validator has already found an error on the matchingControl
                return;
            }

            // set error on matchingControl if validation fails
            if (control.value !== matchingControl.value) {
                matchingControl.setErrors({ mustMatch: true });
            } else {
                matchingControl.setErrors(null);
            }
        };
    }

    public static OR(
        val1: (control: any) => { [s: string]: boolean },
        val2: (control: any) => { [s: string]: boolean }
    ) {
        return (control: any) => {
            let res = val1(control);
            if (!res) {
                return null;
            } else {
                res = val2(control);
                if (!res) {
                    return null;
                }
                return res;
            }
        };
    }

    public static validUrl(control: FormControl): { [s: string]: boolean } | null {
        if (!control.value) {
            return null;
        }
        const valid =
            /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/.test(
                control.value
            );
        return valid ? null : { url: true };
    }

    public static validJson(control: FormControl): { [s: string]: boolean } | null {
        try {
            JSON.parse(control.value);
        } catch (e) {
            return { json: true };
        }
        return null;
    }

    public static cannotContainSpace(control: FormControl): { [s: string]: boolean } | null {
        if (control.value && (control.value as string).indexOf(' ') >= 0) {
            return { cannotContainSpace: true };
        }
        return null;
    }

    public static startWithAlpha(control: FormControl): { [s: string]: boolean } | null {
        if (control.value && !START_WITH_ALPHABET.test(control.value)) {
            return { startWithAlpha: true };
        }
        return null;
    }

    public static noStartEndSpaces(control: FormControl): { [s: string]: boolean } | null {
        if (control.value && (control.value.toString().startsWith(' ') || control.value.toString().endsWith(' '))) {
            return { noStartEndSpaces: true };
        }
        return null;
    }

    public static noStartEndHyphenOrUnderscore(control: FormControl): { [s: string]: boolean } | null {
        if (
            control?.value?.toString()?.startsWith('_') ||
            control?.value?.toString()?.endsWith('_') ||
            control?.value?.toString()?.startsWith('-') ||
            control?.value?.toString()?.endsWith('-')
        ) {
            return { noStartEndHyphenOrUnderscore: true };
        }
        return null;
    }

    public static noStartEndSpacesFroalaContain(control: FormControl): { [s: string]: boolean } | null {
        const value = (control.value || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, '')
            .trim();
        if (!value) {
            return { noStartEndSpacesFroalaContain: true };
        }
        if (value && (value.toString().startsWith(' ') || value.toString().endsWith(' '))) {
            return { noStartEndSpacesFroalaContain: true };
        }
        return null;
    }

    public static onlySpaceFroalaContain(control: FormControl): { [s: string]: boolean } | null {
        const value = (control.value || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, '')
            .trim();
        if (!value && !(control.value || '').includes('<img')) {
            return { onlySpaceFroalaContain: true };
        }
        return null;
    }

    public static noStartEndSlash(control: FormControl): { [s: string]: boolean } | null {
        if (control.value && (control.value.toString().startsWith('/') || control.value.toString().endsWith('/'))) {
            return { noStartEndSlash: true };
        }
        return null;
    }

    public static files(files: string[]) {
        return (control: { value: string }): { [s: string]: boolean } | null => {
            if (control.value && !files.includes(control.value)) {
                return { files: true };
            }
            return null;
        };
    }

    public static minLengthThreeWithoutSpace(control: FormControl): { [s: string]: boolean } | null {
        if (control.value && control.value.trim()?.length < 3) {
            return { minlengthWithSpace: true };
        }
        return null;
    }

    public static minLengthFourWithoutSpace(control: FormControl): { [s: string]: boolean } | null {
        if (control.value && control.value.trim()?.length < 4) {
            return { minlengthWithSpace: true };
        }
        return null;
    }

    public static websiteCount(control: AbstractControl): { [key: string]: any } | null {
        return control.value
            .split(',')
            .filter((e: { trim: () => { (): any; new (): any; length: any } }) => e.trim().length).length > 2
            ? { count: 'Only 2 websites are allowed.' }
            : null;
    }

    public static valueExist(): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            if (!control || !control.parent) {
                return null;
            }
            const currentValue = control.value.trim();
            const currentExist = control.root.value.map((p: any) => p.ip).includes(currentValue);
            if (currentExist && currentValue.length) {
                return { currentExist: true };
            }
            return null;
        };
    }

    public static removeNullKeys(requestObject: any): any {
        return Object.entries(requestObject).reduce((a, [k, v]) => (v === null ? a : (((a as any)[k] = v), a)), {});
    }

    public static removeNullKeysFromNestedObject(requestObject: any): any {
        if (requestObject) {
            Object.entries(requestObject).forEach(([k, v]) => {
                if (v && typeof v === 'object') {
                    this.removeNullKeysFromNestedObject(v);
                }
                if ((v && typeof v === 'object' && !Object.keys(v).length) || v === null || v === undefined) {
                    if (Array.isArray(requestObject)) {
                        requestObject.splice(+k, 1);
                    } else {
                        delete requestObject[k];
                    }
                }
            });
        }
        return requestObject;
    }

    public static elementExistsInList(list: Array<any>, key?: any): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            if (control.value) {
                let value: any;
                if (key) {
                    value = control.value[key];
                } else {
                    value = control.value;
                }
                if (!list.find((val) => val === value)) {
                    return { elementExistsInList: true };
                }
            }
            return null;
        };
    }

    public static minSelected(count?: number): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            if (control.value) {
                if (control.value?.length < (count ?? 1)) {
                    return { minSelected: { requiredCount: count, actualCount: control.value?.length } };
                }
            }
            return null;
        };
    }

    public static checkTextType(type: 'Unicode' | 'Normal'): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            if (control.value) {
                const nonLatinCharacters = control.value.match(new RegExp(SMS_TEMPLATE_UNICODE_REGEX, 'gm'));
                return nonLatinCharacters?.length
                    ? type === 'Unicode'
                        ? null
                        : { checkTextType: true, invalidCharacters: nonLatinCharacters }
                    : type === 'Normal'
                      ? null
                      : { checkTextType: true };
            }
            return null;
        };
    }

    public static onlyAsciiPrintable(control: AbstractControl): { [key: string]: any } | null {
        if (control.value) {
            const nonAsciiPrintableCharacters = control.value.match(
                new RegExp(NON_ASCII_PRINTABLE_CHARACTERS_REGEX, 'gm')
            );
            if (nonAsciiPrintableCharacters) {
                return { onlyAsciiPrintable: { invalidCharacters: nonAsciiPrintableCharacters } };
            }
        }
        return null;
    }

    public static onlyOneOccurrence(regex: RegExp): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            if (control.value && control.value.match(regex)?.length > 1) {
                return { onlyOneOccurrence: true };
            }
            return null;
        };
    }
    /**
     * Grater than utility method to return error when current control is greater than
     * target control
     *
     * @static
     * @param {string} currentControlName Current control name for comparison
     * @param {string} targetControlName Target control name for comparison
     * @return {*}  {ValidatorFn} Validator function with the result of comparison
     * @memberof CustomValidators
     */
    public static greaterThan(
        currentControlName: string,
        targetControlName: string,
        multiplier = new BehaviorSubject<number>(1),
        currency: string = ''
    ): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (control && control.get(currentControlName) && control.get(targetControlName)) {
                const currentValue = control.get(currentControlName)?.value;
                const targetValue = control.get(targetControlName)?.value;
                const currencyValue = control.get(currency)?.value;
                const multiplierValue = multiplier.getValue();
                if (targetValue > 0 && currentValue > targetValue * multiplierValue) {
                    control
                        .get(currentControlName)
                        ?.setErrors({ limitExceeded: { limitValue: targetValue * multiplierValue } });
                    control.get(currentControlName)?.markAsTouched();
                    return { limitExceeded: { limitValue: targetValue * multiplierValue } };
                } else if (
                    targetValue === 0 &&
                    (currencyValue === 1 || currency === 'INR') &&
                    currentValue > MaxUserOverusageLimit.INR
                ) {
                    control
                        .get(currentControlName)
                        ?.setErrors({ limitExceeded: { limitValue: MaxUserOverusageLimit.INR } });
                    control.get(currentControlName)?.markAsTouched();
                    return { limitExceeded: { limitValue: MaxUserOverusageLimit.INR } };
                } else if (
                    targetValue === 0 &&
                    (currencyValue !== 1 || currency === 'USD' || currency === 'GBP') &&
                    currency !== 'INR' &&
                    currentValue > MaxUserOverusageLimit.Other
                ) {
                    control
                        .get(currentControlName)
                        ?.setErrors({ limitExceeded: { limitValue: MaxUserOverusageLimit.Other } });
                    control.get(currentControlName)?.markAsTouched();
                    return { limitExceeded: { limitValue: MaxUserOverusageLimit.Other } };
                }
                control.get(currentControlName)?.setErrors(null);
                return null;
            }
            return null;
        };
    }

    /**
     * Validates the JSON if it is provided else no error
     *
     * @static
     * @param {FormControl<string>} control Form Control instance
     * @return {({ [s: string]: boolean } | null)} Error or null based on validation
     * @memberof CustomValidators
     */
    public static validateJsonIfProvided(control: FormControl<string>): { [s: string]: boolean } | null {
        if (control.value) {
            return CustomValidators.validJson(control);
        }
        return null;
    }

    public static noStartEndCharacter(character: string = ''): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (control?.value.toString().startsWith(character) || control.value.toString().endsWith(character)) {
                return { noStartEndCharacter: true };
            }
            return null;
        };
    }
    public static limitCountByPattern(character: string = '', maxCount: number): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (control?.value.toString()) {
                const value = control?.value.toString();
                return value.split(character).length > maxCount
                    ? { limitCountByPattern: true, maxLimitCount: maxCount }
                    : null;
            }
            return null;
        };
    }

    public static unicodeOrAtleastOneVar(control: FormControl<string>): { [s: string]: boolean } | null {
        if (control.value) {
            // If Value contain Non Latin Unicode Characters
            if (control.value.match(new RegExp(NON_LATIN_UNICODE_REGEX, 'gm'))) {
                return null;
            }
            // If Value contain Variable like ##var1##
            else if (control.value.match(CONTENT_BETWEEEN_HASH_TAG_REGEX)) {
                return null;
            }
            // If Value contain Variable like {#var1#}
            else if (control.value.match(CONTENT_BETWEEEN_CURLY_HASH_TAG_REGEX)) {
                return null;
            } else {
                return { unicodeOrAtleastOneVar: true };
            }
        }
        return null;
    }

    public static validRegex(control: FormControl<string>): { [s: string]: boolean } | null {
        if (control.value) {
            try {
                const rexExp = new RegExp(control.value);
                if (rexExp) {
                    return null;
                }
            } catch (e) {
                return { validRegex: true };
            }
        }
        return null;
    }

    /**
     * Checks if the string matches the given regular expression
     * this is created because some regex behave differently in RegExp .test() method
     *
     * @static
     * @param {RegExp} regex
     * @return {*}  {ValidatorFn}
     * @memberof CustomValidators
     */
    public static stringMatch(regex: RegExp): ValidatorFn {
        return (control: AbstractControl): { [key: string]: any } | null => {
            if (control.value && !control.value.match(regex)?.length) {
                return { stringMatch: true };
            }
            return null;
        };
    }
}
