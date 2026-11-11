import {align} from './core.ts';

const names:Record<string,string>={ay:'a',bee:'b',cee:'c',see:'c',dee:'d',ee:'e',eff:'f',gee:'g',aitch:'h',jay:'j',kay:'k',el:'l',em:'m',en:'n',oh:'o',pee:'p',cue:'q',queue:'q',ar:'r',ess:'s',tee:'t',you:'u',vee:'v',doubleyou:'w',ex:'x',why:'y',zee:'z',zed:'z'};

export function parseLetters(transcript:string):string|null {
  const source=transcript.trim().toLowerCase().replace(/double[ -]you/g,'doubleyou');
  if(!source)return null;
  const tokens=source.split(/[\s.,;:!?–—-]+/u).filter(Boolean);
  if(!tokens.length)return null;
  const letters=[];
  for(const token of tokens) {
    const letter=/^\p{L}\p{M}*$/u.test(token)?token:names[token];
    if(!letter)return null;
    letters.push(letter);
  }
  return letters.join('');
}

export function scoreSpeech(spoken:string,recognized:string|null,accepted:string[]){
  const falseAccept=recognized!==null&&accepted.includes(recognized)&&!accepted.includes(spoken);
  const falseReject=(recognized===null||!accepted.includes(recognized))&&accepted.includes(spoken);
  return {exact:spoken===recognized, errors:align(spoken,recognized??'').distance,
    letters:Array.from(spoken).length,falseAccept,falseReject};
}
