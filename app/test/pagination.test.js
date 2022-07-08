const { describe, before, afterEach } = require('mocha');
const assert = require('assert');
const { createSandbox } = require('sinon');
const Pagination = require('../src/pagination');

describe('Pagination tests', () => {
  let sandbox;

  before(() => {
    sandbox = createSandbox();
  });

  afterEach(() => sandbox.restore());

  describe('#Pagination', () => {
    it('should retry an request twice before throing an exception and validate request params and flow', async () => {
      const expectedCallCount = 2;
      const expectedTimeout = 10;

      const pagination = new Pagination();
      pagination.maxRetries = expectedCallCount;
      pagination.retryTimeout = expectedTimeout;
      pagination.maxRequestTimeout = expectedTimeout;

      const error = new Error('timeout');

      sandbox.spy(pagination, pagination.handleRequest.name);
      sandbox.stub(Pagination, Pagination.sleep.name).resolves();

      sandbox
        .stub(pagination.request, pagination.request.makeRequest.name)
        .rejects(error);

      const dataRequest = { url: 'https://google.com', page: 0 };
      await assert.rejects(pagination.handleRequest(dataRequest), error);
      assert.deepStrictEqual(
        pagination.handleRequest.callCount,
        expectedCallCount
      );
      const lastCall = 1;
      const firstCallArg = pagination.handleRequest.getCall(lastCall).firstArg;
      const firstCallRetries = firstCallArg.retries;
      assert.deepStrictEqual(firstCallRetries, expectedCallCount);
    });
    it('should return data from request when succeded');
  });
});
