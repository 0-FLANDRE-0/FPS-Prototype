export function releaseMedicalReservation(inv,t){if(inv.medicalReservations?.get(t.itemInstanceId)===t)inv.medicalReservations.delete(t.itemInstanceId);}
export function medicalReserved(inv,id){
 for(const[itemId,t]of inv.medicalReservations||[]){if(t.status!=='active'){releaseMedicalReservation(inv,t);continue;}let item=inv.items.get(itemId);const seen=new Set();while(item&&!seen.has(item.instanceId)){if(item.instanceId===id)return true;seen.add(item.instanceId);item=item.owner?.startsWith('container:')?inv.items.get(item.owner.slice(10)):null;}}
 return false;
}
