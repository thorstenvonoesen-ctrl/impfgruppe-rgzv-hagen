// Test-only Supabase adapter backed by isolated real PostgreSQL.
export function pgMailClient(pg, clubId) {
  const ident = value => { if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error('Invalid fixture identifier'); return value }
  return {
    auth: { getUser: async token => ({ data: { user: token === 'fixture-admin' ? { id: clubId } : null } }) },
    async rpc(name,args={}) {
      try {
        const values=Object.values(args).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v)
        const rows=(await pg.query(`select to_jsonb(r) item from ${ident(name)}(${values.map((_,i)=>`$${i+1}`).join(',')}) r`,values)).rows
        return {data:name==='claim_mail_delivery'?rows.map(r=>r.item):rows[0]?.item,error:null}
      } catch(error) {return {data:null,error}}
    },
    from(table) {
      ident(table)
      let fields='*',patch,single=false,count=10000,order=''
      const filters=[],values=[]
      const param=v=>{values.push(v);return `$${values.length}`}
      const q={
        select(f){fields=f.replace(/\s/g,'');return q},update(p){patch=p;return q},
        eq(k,v){filters.push(`${ident(k)}=${param(v)}`);return q},
        ilike(k,v){filters.push(`${ident(k)} ilike ${param(v)}`);return q},
        lt(k,v){filters.push(`${ident(k)}<${param(v)}`);return q},
        lte(k,v){filters.push(`${ident(k)}<=${param(v)}`);return q},
        in(k,v){filters.push(`${ident(k)} in (${v.map(param).join(',')})`);return q},
        limit(n){count=n;return q},
        order(k,opts){order=` order by ${ident(k)} ${opts?.ascending===false?'desc':'asc'}`;return q},
        single(){single=true;return q},maybeSingle(){single=true;return q},
        async then(resolve){try {
          const where=filters.length?` where ${filters.join(' and ')}`:''
          if(!/^[a-z_,*]+$/.test(fields))throw new Error('Invalid fixture projection')
          const sql=patch?`update ${table} set ${Object.entries(patch).map(([k,v])=>`${ident(k)}=${param(v)}`).join(',')}${where} returning to_jsonb(${table}) item`:
            `select to_jsonb(r) item from (select ${fields} from ${table}${where}${order} limit ${count}) r`
          const rows=(await pg.query(sql,values)).rows.map(r=>r.item)
          resolve({data:single?(rows[0]||null):rows,error:null})
        }catch(error){resolve({data:null,error})}}
      };return q
    }
  }
}
