export default interface actionType<T> {
  payload: T;
  type?: string;
  urlData: UrlDataType;
}

export interface UrlDataType {
  chatSessionId: string
  tabSessionId: string
}
