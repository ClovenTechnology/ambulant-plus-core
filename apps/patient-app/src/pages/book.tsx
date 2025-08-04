import React from 'react';

const clinicians = [
  { name: 'Dr. Lindiwe Mokoena', specialty: 'General Practitioner', premium: true },
  { name: 'Dr. Mzizi Khumalo', specialty: 'Dentist', premium: false },
  { name: 'Nurse Sarah Ndaba', specialty: 'Primary Care Nurse', premium: true },
];

export default function BookConsultation() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-blue-900">📅 Book a Consultation</h2>
      <p className="text-gray-600">
        Find your preferred clinician, choose a slot, and conclude payment to confirm your appointment.
      </p>

      {clinicians.map((doc) => (
        <div key={doc.name} className="bg-white p-4 shadow rounded-xl border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-lg text-purple-700">{doc.name}</p>
              <p className="text-sm text-gray-500">{doc.specialty}</p>
            </div>
            {doc.premium && (
              <span className="text-xs text-white bg-purple-700 px-2 py-1 rounded">⚡ Premium</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
