export type ClientParamKind = 'name' | 'number' | 'mail';

// Default client params arrive with different names depending on the backend
// (e.g. "number"/"mail" or "Phonenumber"/"Email"); map them to one kind.
const CLIENT_PARAM_KINDS: Record<string, ClientParamKind> = {
    name: 'name',
    number: 'number',
    phone: 'number',
    phonenumber: 'number',
    mobile: 'number',
    mobilenumber: 'number',
    mail: 'mail',
    email: 'mail',
};

export function getClientParamKind(name: string | null | undefined): ClientParamKind | null {
    return CLIENT_PARAM_KINDS[(name ?? '').toLowerCase().replace(/[\s_-]/g, '')] ?? null;
}
