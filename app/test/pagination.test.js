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
    it('#sleep should be a Promise object and not return values', async () => {
      const clock = sandbox.useFakeTimers();
      const time = 1;
      const pendingPromise = Pagination.sleep(time);
      clock.tick(time);

      assert.ok(pendingPromise instanceof Promise);
      const result = await pendingPromise;
      assert.ok(result == undefined);
    });

    describe('#handleRequest', () => {
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
        const firstCallArg =
          pagination.handleRequest.getCall(lastCall).firstArg;
        const firstCallRetries = firstCallArg.retries;
        assert.deepStrictEqual(firstCallRetries, expectedCallCount);

        const expectedArgs = {
          url: `${dataRequest.url}?tid=${dataRequest.page}`,
          method: 'get',
          timeout: expectedTimeout
        };

        const firstCallArgs = pagination.request.makeRequest.getCall(0).args;
        assert.deepStrictEqual(firstCallArgs, [expectedArgs]);

        assert.ok(Pagination.sleep.calledWithExactly(expectedTimeout));
      });
      it('should return data from request when succeded', async () => {
        const data = { result: 'ok' };
        const pagination = new Pagination();
        sandbox
          .stub(pagination.request, pagination.request.makeRequest.name)
          .resolves(data);

        const result = await pagination.handleRequest({
          url: 'http://google.com',
          page: 1
        });
        assert.deepStrictEqual(result, data);
      });
    });

    describe('#getPaginated', () => {});
    const responseMock = [
      {
        amount: 0.01,
        date: 1373144853,
        price: 200,
        tid: 5710,
        type: 'sell'
      },
      {
        amount: 0.01800435,
        date: 1373126422,
        price: 213,
        tid: 5708,
        type: 'buy'
      }
    ];

    it('should updated request id on each request', async () => {
      const pagination = new Pagination();

      sandbox.stub(Pagination, Pagination.sleep.name).resolves();

      sandbox
        .stub(pagination, pagination.handleRequest.name)
        .onCall(0)
        .resolves([responseMock[0]])
        .onCall(1)
        .resolves([responseMock[1]])
        .onCall(2)
        .resolves([]);

      sandbox.spy(pagination, pagination.getPaginated.name);
      const data = { url: 'https://google.com', page: 1 };

      const secondCallExpectation = {
        ...data,
        page: responseMock[0].tid
      };

      const thirdCallExpectation = {
        ...secondCallExpectation,
        page: responseMock[1].tid
      };

      /**
       *
       * para chamar uma função que é o generator
       * Array.from(pagination.getPaginated()) => dessa forma ele não espera os dados sob demanda
       * ele vvai guardar tudo e, memória e só depois jogar no array
       * const r = pagination.getPaginated()
       * r.next() => {done: true | false, value: {}}
       * a melhor forma é usar o for of
       */

      const gen = pagination.getPaginated(data);
      for await (const result of gen) {
        // console.log('page');
      }

      const getFirstArgFromCall = (value) =>
        pagination.handleRequest.getCall(value).firstArg;
      assert.deepStrictEqual(getFirstArgFromCall(0), data);
      assert.deepStrictEqual(getFirstArgFromCall(1), secondCallExpectation);
      assert.deepStrictEqual(getFirstArgFromCall(2), thirdCallExpectation);
    });

    it('should stop requesting request return an empty array', async () => {
      const pagination = new Pagination();

      sandbox.stub(Pagination, Pagination.sleep.name).resolves();

      sandbox
        .stub(pagination, pagination.handleRequest.name)
        .onCall(0)
        .resolves([responseMock[0]])
        .onCall(1)
        .resolves([]);

      sandbox.spy(pagination, pagination.getPaginated.name);
      const data = { url: 'https://google.com', page: 1 };

      // dica valiosa
      const iterator = await pagination.getPaginated(data);
      const [firstResult, secondReseult] = await Promise.all([
        iterator.next(),
        iterator.next()
      ]);

      const expectedFirstCall = {
        done: false,
        value: [responseMock[0]]
      };
      assert.deepStrictEqual(firstResult, expectedFirstCall);
    });
  });
});
