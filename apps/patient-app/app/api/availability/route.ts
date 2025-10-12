import { NextResponse } from 'next/server';

export async function GET(){
  return NextResponse.json({
    clinicians:[
      { id:'doc-za-001', name:'Dr. Lindiwe Maseko', specialty:'General Practitioner', online:true },
      { id:'spec-za-201', name:'Dr. Ahmed Patel', specialty:'Endocrinologist', online:false },
      { id:'well-za-301', name:'Buhle Dube', specialty:'Nutritionist', online:true }
    ],
    slots:[
      { clinicianId:'doc-za-001', start:'2025-08-10T09:00:00+02:00' },
      { clinicianId:'doc-za-001', start:'2025-08-10T10:30:00+02:00' },
      { clinicianId:'spec-za-201', start:'2025-08-11T14:00:00+02:00' },
      { clinicianId:'well-za-301', start:'2025-08-10T18:00:00+02:00' }
    ]
  });
}
