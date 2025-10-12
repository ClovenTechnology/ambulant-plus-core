

var errorListener = Array.of()

export function registerErrorListener(listener) {
    if (!errorListener.includes(listener)) {
        errorListener.push(listener)
    }
}

export function unRegisterErrorListener(listener) {
    if (listener) {
        var index = errorListener.indexOf(listener);
        if (index != -1) {
            errorListener.splice(index, 1)
        }
    }
}

export const dispatchErrorData = (data) => {
    errorListener.forEach((listener) => {
        listener.onResult(data);
    });
}