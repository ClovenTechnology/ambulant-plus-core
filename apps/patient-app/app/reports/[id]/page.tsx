export default function ReportDetail({ params }:{ params:{ id:string } }){
  const id = decodeURIComponent(params.id);
  // Prefer public file path for demo; your API route can be wired similarly
  const src = /reports/files/.pdf;
  return (
    <main className="p-6 space-y-3">
      <h1 className="text-lg font-semibold">Report — {id}</h1>
      <div className="border rounded bg-white p-2">
        <object data={src} type="application/pdf" className="w-full" style={{height: "70vh"}}>
          <p className="text-sm p-4">PDF viewer unavailable. <a className="underline" href={src} target="_blank">Download</a></p>
        </object>
      </div>
    </main>
  );
}