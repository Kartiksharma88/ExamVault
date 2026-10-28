import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';

@Info({ title: 'HelloWorldContract', description: 'Milestone D Test Contract' })
export class HelloWorldContract extends Contract {
  constructor() {
    super('HelloWorldContract');
  }

  @Transaction(true)
  public async Ping(ctx: Context, message: string): Promise<string> {
    const caller = ctx.clientIdentity.getMSPID();
    return JSON.stringify({
      pong: message,
      callerMSP: caller,
      txId: ctx.stub.getTxID(),
    });
  }
}

export const contracts: any[] = [HelloWorldContract];
