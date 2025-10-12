import noble from '@abandonware/noble';

function toHex(buf: Buffer) { return Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join(''); }

async function main() {
  console.log('[ble-dump] starting…');
  await new Promise<void>((resolve, reject) => {
    noble.on('stateChange', (s) => {
      console.log('[ble-dump] adapter state:', s);
      if (s === 'poweredOn') noble.startScanning([], true, (e) => e && reject(e));
    });
    noble.on('discover', async (peripheral) => {
      const name = peripheral.advertisement?.localName || '';
      if (!/HC-?21/i.test(name)) return;
      console.log('[ble-dump] found', name, peripheral.id, peripheral.address);
      noble.stopScanning();

      await new Promise<void>((res, rej) => peripheral.connect((e) => e ? rej(e) : res()));
      console.log('[ble-dump] connected');

      const services = await new Promise<any[]>((res, rej) =>
        peripheral.discoverServices([], (e, svcs) => e ? rej(e) : res(svcs)));
      console.log('[ble-dump] services:', services.length);

      for (const s of services) {
        console.log(' Service:', s.uuid);
        const chars = await new Promise<any[]>((res, rej) =>
          s.discoverCharacteristics([], (e, ch) => e ? rej(e) : res(ch)));
        for (const c of chars) {
          const props = (c.properties || []).join(',');
          console.log('  Char:', c.uuid, 'props=', props);
          if (props.includes('notify')) {
            c.on('data', (d: Buffer, isNotif: boolean) => {
              if (isNotif) console.log('   🔔 notify', c.uuid, 'len=', d.length);
            });
            await new Promise<void>((res, rej) => c.subscribe((e) => e ? rej(e) : res()));
          }
          if (props.includes('read')) {
            try {
              const data = await new Promise<Buffer>((res, rej) => c.read((e,d)=>e?rej(e):res(d)));
              console.log('   read', c.uuid, 'len=', data.length, toHex(data.slice(0,16)));
            } catch {}
          }
        }
      }

      peripheral.disconnect(()=>process.exit(0));
    });
  });
}

main().catch((e) => { console.error(e); process.exit(1); });