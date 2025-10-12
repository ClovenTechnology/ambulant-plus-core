'use client';
export default function Error({error, reset}:{error:Error; reset:()=>void}){
  return (
    <main className='p-6 space-y-3'>
      <h1 className='text-xl font-semibold'>RTC Error</h1>
      <div className='text-sm text-red-600'>{error?.message || "Unexpected error"}</div>
      <button className='border rounded px-3 py-1' onClick={()=>reset()}>Try again</button>
    </main>
  );
}