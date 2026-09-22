// frontend/tests/__mocks__/axios.js
const createMockAxiosInstance = () => {
  const instance = jest.fn(() =>
    Promise.resolve({
      data: {},
    })
  );

  instance.defaults = {
    baseURL: 'http://localhost:5000',
    withCredentials: true,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  instance.interceptors = {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
      clear: jest.fn(),
    },
    response: {
      use: jest.fn(),
      eject: jest.fn(),
      clear: jest.fn(),
    },
  };

  instance.get = jest.fn(() => Promise.resolve({ data: {} }));
  instance.post = jest.fn(() => Promise.resolve({ data: {} }));
  instance.put = jest.fn(() => Promise.resolve({ data: {} }));
  instance.patch = jest.fn(() => Promise.resolve({ data: {} }));
  instance.delete = jest.fn(() => Promise.resolve({ data: {} }));
  instance.head = jest.fn(() => Promise.resolve({ data: {} }));
  instance.options = jest.fn(() => Promise.resolve({ data: {} }));
  instance.request = jest.fn(() => Promise.resolve({ data: {} }));

  return instance;
};

const mockAxios = {
  create: jest.fn(() => createMockAxiosInstance()),

  defaults: {
    baseURL: 'http://localhost:5000',
    withCredentials: true,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  },

  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
      clear: jest.fn(),
    },
    response: {
      use: jest.fn(),
      eject: jest.fn(),
      clear: jest.fn(),
    },
  },

  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  head: jest.fn(() => Promise.resolve({ data: {} })),
  options: jest.fn(() => Promise.resolve({ data: {} })),
  request: jest.fn(() => Promise.resolve({ data: {} })),
};

export default mockAxios;