

export function formatDateTime(inputTime, isComplete = true) {
    var date = new Date(inputTime);
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    m = m < 10 ? "0" + m : m;
    var d = date.getDate();
    d = d < 10 ? "0" + d : d;
    var h = date.getHours();
    h = h < 10 ? "0" + h : h;
    var minute = date.getMinutes();
    var second = date.getSeconds();
    minute = minute < 10 ? "0" + minute : minute;
    second = second < 10 ? "0" + second : second;
    var result = "";
    if (isComplete) {
        result = y + "-" + m + "-" + d + "|" + h + ":" + minute + ":" + second;
    } else {
        result = y + "-" + m + "-" + d;
    }
    return result
}

//洛杉矶时区时间格式化
export function formatDateTime1(inputTime) {
    var date = new Date(inputTime);
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }).format(date);
    return formattedDate;
}

export function compareTime(ts, targetTs) {
    const date = new Date(ts);
    const targetDate = new Date(targetTs);
    console.log(`年：${date.getFullYear()}==${targetDate.getFullYear()}月：${date.getMonth()}==${targetDate.getMonth()}日：${date.getDate()}==${targetDate.getDate()}`)
    if (date.getFullYear() === targetDate.getFullYear() &&
        date.getMonth() === targetDate.getMonth() &&
        date.getDate() === targetDate.getDate()) {
        return true;
    }
    return false;
}

export function formatToHm(time) {
    return ` ${Math.floor(time / (1000 * 60 * 60))}h${Math.floor((time % (1000 * 60 * 60)) / (1000 * 60))}m`;
}

export function formatMinutesToHours(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;

    // 格式化小时和分钟为两位数
    let formattedHours = (hours < 10 ? '0' : '') + hours.toString();
    let formattedMinutes = (minutes < 10 ? '0' : '') + minutes.toString();
    return `${formattedHours} h ${formattedMinutes} m`;
}

export function formatNowTime() {
    // 获取当前时间
    const now = new Date();

    // 格式化年份
    const year = now.getFullYear();

    // 格式化月份，注意月份是从0开始的，所以需要加1，并且确保两位数
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // 格式化日期，确保两位数
    const day = String(now.getDate()).padStart(2, '0');

    // 格式化小时，24小时制，确保两位数
    const hours = String(now.getHours()).padStart(2, '0');

    // 格式化分钟，确保两位数
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // 格式化秒，确保两位数
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // 组合成所需的格式
    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    return formattedDateTime;
}

export function addOneSecond(currentTime) {
    // 创建一个新的 Date 对象，避免修改原始对象
    let newTime = new Date(currentTime);

    // 增加一秒
    newTime.setSeconds(newTime.getSeconds() + 1);

    return newTime;
}

export function formatDateTimeToHms(dateTime) {
    // 获取小时（24小时制），确保两位数
    const hours = String(dateTime.getHours()).padStart(2, '0');
    // 获取分钟，确保两位数
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    // 获取秒，确保两位数
    const seconds = String(dateTime.getSeconds()).padStart(2, '0');
    // 组合成所需的格式
    const formattedDateTime = `${hours}:${minutes}:${seconds}`;
    return formattedDateTime;
}