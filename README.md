import { getStorageInfo, setStorage, removeStorage, getStorage } from "zmp-sdk";

const getAppStorageInfo = async (key: string) => {
  try {
    const restStorage = await getStorageInfo();
    return restStorage[key];
  } catch (error) {
    // xử lý khi gọi api thất bại
    console.log(error);
    return null;
  }
};

const getAppStorageData = async (key: string) => {
  try {
    const res = await getStorage({
      keys: [key],
    });
    return res[key];
  } catch (error) {
    // xử lý khi gọi api thất bại
    console.log(error);
    return null;
  }
};

const setAppStorageData = async (data: object) => {
  try {
    await setStorage({
      data: data,
    });
  } catch (error) {
    // xử lý khi gọi api thất bại
    console.log(error);
  }
};

const removeStorageData = async (data: Array<string>) => {
  try {
    await removeStorage({
      keys: data,
    });
  } catch (error) {
    // xử lý khi gọi api thất bại
    console.log(error);
  }
};

export {
  getAppStorageInfo,
  setAppStorageData,
  removeStorageData,
  getAppStorageData,
};
