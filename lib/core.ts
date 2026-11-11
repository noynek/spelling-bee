export type Word = {id:string; spelling:string; alternatives:string[]; definition?:string; example?:string; language?:string; pronunciation?:string; difficulty?:string; notes?:string};
export type List = {id:string; name:string; words:Word[]};
export type Attempt = {wordId:string; spelling:string; correct:boolean; retry:boolean; at:number};
export type Session = {name:string; words:Word[]; index:number; result?:string; spokenResult?:boolean; retry:boolean; correct:number};
export type Student = {id:string; name:string; attempts:Attempt[]; session?:Session};
export const word = (spelling:string):Word => ({id:crypto.randomUUID(), spelling, alternatives:[]});
export const lines = (source:string) => source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
const characters = (s:string) => Array.from(s);
export function align(expected:string, entered:string) {
  const a=characters(expected), b=characters(entered);
  const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+Number(a[i-1]!==b[j-1]));
  }
  const changes:string[]=[];
  let i=a.length,j=b.length;
  while(i||j) {
    if(i&&j&&d[i][j]===d[i-1][j-1]+Number(a[i-1]!==b[j-1])) {
      if(a[i-1]!==b[j-1]) changes.push(`Position ${i}: expected “${a[i-1]}”, got “${b[j-1]}”.`);
      i--;j--;
    } else if(i&&d[i][j]===d[i-1][j]+1) {changes.push(`Missing “${a[i-1]}” at position ${i}.`); i--;}
    else {changes.push(`Extra “${b[j-1]}” at position ${j}.`); j--;}
  }
  return {distance:d[a.length][b.length],changes:changes.reverse()};
}
export function grade(entry:Word, answer:string) {
  const forms=[entry.spelling,...entry.alternatives];
  const best=forms.map(expected=>({expected,...align(expected,answer)})).reduce((a,b)=>a.distance<=b.distance?a:b);
  return {...best,correct:best.distance===0};
}
export function merge(words:Word[]) {
  const result=new Map<string,Word>();
  for(const w of words) {
    const prior=result.get(w.spelling);
    result.set(w.spelling,prior?{...w,...prior,alternatives:[...new Set([...prior.alternatives,...w.alternatives])]}:w);
  }
  return [...result.values()];
}
export function missed(attempts:Attempt[]) {
  const latest=new Map(attempts.map(a=>[a.wordId,a.correct]));
  return new Set([...latest].filter(([,correct])=>!correct).map(([id])=>id));
}
