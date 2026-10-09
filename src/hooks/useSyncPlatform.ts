// PAUSADO: la sincronización con Vinted/Wallapop está oculta en la UI (ver pages/Venta.tsx).
// Este módulo se conserva para reactivarla.
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SyncPlatform = 'vinted' | 'wallapop'

export interface PlatformItem {
  platform_id: string   // vinted_id o wallapop_id
  name: string
  brand?: string
  size?: string
  price: number
}

export interface SyncResult {
  total_found: number
  synced: number
}

// Bookmarklet: Vinted
export function generateVintedBookmarklet(appOrigin: string): string {
  const script = `(function(){
var items=[];
document.querySelectorAll('.feed-grid__item').forEach(function(card){
  var a=card.querySelector('a[href*="/items/"]');
  var m=a&&a.href.match(/\\/items\\/(\\d+)/);
  if(!m)return;
  var img=card.querySelector('img');
  var alt=img&&img.alt||'';
  var name=alt.split(',')[0].trim();
  var brand=(alt.match(/marca:\\s*([^,]+)/i)||[])[1];
  var size=(alt.match(/tama[\\u00f1n]o:\\s*([^,]+)/i)||[])[1];
  var ps=(alt.match(/([\\d]+[,.]\\d+|[\\d]+)\\s*\\u20ac/)||[])[1];
  items.push({platform_id:m[1],name:name||'',brand:(brand||'').trim(),size:(size||'').trim(),price:parseFloat((ps||'0').replace(',','.'))||0});
});
if(!items.length){alert('No se encontraron prendas. \\u00bfEst\\u00e1s en tu perfil de Vinted?');return;}
var data=btoa(unescape(encodeURIComponent(JSON.stringify(items))));
location.href='${appOrigin}/venta?vinted_import='+data;
})()`.replace(/\n/g, '')
  return `javascript:${encodeURIComponent(script)}`
}

// Bookmarklet: Wallapop
// Usamos String.fromCharCode(8364) para el simbolo euro y evitar problemas de encoding
export function generateWallapopBookmarklet(appOrigin: string): string {
  const s1 = "(function(){"
  const s2 = "var euro=String.fromCharCode(8364);"
  const s3 = "function qs(root,sel){"
  const s4 = "var r=[];var w=function(n){"
  const s5 = "try{r.push.apply(r,n.querySelectorAll(sel));"
  const s6 = "n.querySelectorAll('*').forEach(function(e){if(e.shadowRoot)w(e.shadowRoot);});"
  const s7 = "}catch(e){}};w(root);return r;}"
  const s8 = "var seen={};var items=[];"
  const s9 = "qs(document,'a[href*=\"/item/\"]').forEach(function(a){"
  const s10 = "var m=a.href.match(/-?(\\d+)$/);if(!m||seen[m[1]])return;"
  const s11 = "var row=a.closest('li')||a.parentElement&&a.parentElement.parentElement;"
  const s12 = "var det=qs(row||document,'.item-details')[0];var scope=det||row||document.body;"
  const s13 = "var nameEl=qs(scope,'p,span,h2,h3').find(function(el){"
  const s14 = "var t=el.textContent.trim();"
  const s15 = "return t.length>2&&t.length<80&&!t.includes(euro)&&el.children.length===0;});"
  const s16 = "var priceEl=qs(scope,'[class*=\"price\"],span').find(function(el){"
  const s17 = "return new RegExp('\\\\d+[,.]?\\\\d*\\\\s*'+euro).test(el.textContent);});"
  const s18 = "var priceStr=priceEl?priceEl.textContent.replace(new RegExp('[^\\\\d,.]','g'),'').replace(',','.'):'0';"
  const s19 = "seen[m[1]]=1;items.push({platform_id:m[1],name:(nameEl?nameEl.textContent.trim():''),price:parseFloat(priceStr)||0});});"
  const s20 = "if(!items.length){alert('No se encontraron productos. Ve a: es.wallapop.com/app/catalog/published');return;}"
  const s21 = "var data=btoa(unescape(encodeURIComponent(JSON.stringify(items))));"
  const s22 = "location.href='" + appOrigin + "/venta?wallapop_import='+data;"
  const s23 = "})()"
  const script = s1+s2+s3+s4+s5+s6+s7+s8+s9+s10+s11+s12+s13+s14+s15+s16+s17+s18+s19+s20+s21+s22+s23
  return "javascript:" + encodeURIComponent(script)
}

// Hook
export function useSyncPlatform() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const importFromBrowser = async (items: PlatformItem[], platform: SyncPlatform) => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesion activa')

      const idField = platform === 'vinted' ? 'vinted_id' : 'wallapop_id'
      const conflictCols = platform === 'vinted' ? 'user_id,vinted_id' : 'user_id,wallapop_id'

      const rows = items.map((item) => ({
        user_id: user.id,
        [idField]: item.platform_id,
        name: item.name,
        brand: item.brand || null,
        size: item.size || null,
        price: item.price || null,
        status: 'en_venta' as const,
        [`on_${platform}`]: true,
        notes: `Importado desde ${platform === 'vinted' ? 'Vinted' : 'Wallapop'}: https://${platform === 'vinted' ? 'www.vinted.es/items' : 'es.wallapop.com/item'}/${item.platform_id}`,
        tags: [] as string[],
        colors: [] as string[],
      }))

      const { error: upsertError } = await supabase
        .from('clothes')
        .upsert(rows, { onConflict: conflictCols })

      if (upsertError) throw new Error(upsertError.message)

      setResult({ total_found: items.length, synced: items.length })
      await qc.invalidateQueries({ queryKey: ['clothes'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return { importFromBrowser, loading, result, error }
}

