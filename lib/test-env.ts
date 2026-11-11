import type {TestContext} from 'node:test';
export function env(t:TestContext,key:string,value:string){
  const before=process.env[key];
  process.env[key]=value;
  t.after(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});
}
