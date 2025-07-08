import React, { useState, useEffect } from 'react';

const NursingCalculator = () => {
  const [beds, setBeds] = useState(
    Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      ratio: '',
      nurseAssigned: null
    }))
  );
  const [nurseAssignments, setNurseAssignments] = useState([]);
  const [includeInCharge, setIncludeInCharge] = useState(true);
  const [includeWardClerk, setIncludeWardClerk] = useState(false);
  const [includeAM515, setIncludeAM515] = useState(false);
  const [includeCNE, setIncludeCNE] = useState(false);
  const [cneHours, setCneHours] = useState('');
  const [currentNursesAM, setCurrentNursesAM] = useState('');
  const [expectedNursesPM, setExpectedNursesPM] = useState(0);
  const [expectedNursesNight, setExpectedNursesNight] = useState(0);

  // Parse ratio string (e.g., "1:2") to number
  const parseRatio = (ratioStr) => {
    if (!ratioStr || !ratioStr.includes(':')) return null;
    const parts = ratioStr.split(':');
    if (parts.length !== 2) return null;
    const nurseCount = parseInt(parts[0]);
    const patientCount = parseInt(parts[1]);
    if (isNaN(nurseCount) || isNaN(patientCount) || nurseCount !== 1) return null;
    return patientCount;
  };

  // Calculate hours from time range (e.g., "1100-2100")
  const calculateHoursFromRange = (timeRange) => {
    if (!timeRange || !timeRange.includes('-')) return 0;
    const [start, end] = timeRange.split('-');
    if (start.length !== 4 || end.length !== 4) return 0;
    
    const startHour = parseInt(start.substring(0, 2));
    const startMin = parseInt(start.substring(2, 4));
    const endHour = parseInt(end.substring(0, 2));
    const endMin = parseInt(end.substring(2, 4));
    
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return 0;
    
    let hours = endHour - startHour;
    let minutes = endMin - startMin;
    
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    
    // Handle overnight shifts
    if (hours < 0) {
      hours += 24;
    }
    
    return hours + (minutes / 60);
  };

  // Calculate admission capacity based on available nurses and current bed assignments
  const calculateAdmissionCapacity = (nurses, currentAssignments) => {
    const totalNurses = nurses - (includeInCharge ? 1 : 0);
    if (totalNurses <= 0) return ['No capacity - no bedside nurses available'];

    // Check available beds
    const occupiedBeds = beds.filter(bed => bed.ratio && parseRatio(bed.ratio) !== null).length;
    const availableBeds = 11 - occupiedBeds;
    
    if (availableBeds === 0) {
      return ['No capacity - all beds occupied'];
    }

    // Calculate current workload
    let usedCapacity = 0;
    currentAssignments.forEach(nurse => {
      if (nurse.beds && nurse.beds.length > 0) {
        usedCapacity += nurse.beds.reduce((sum, b) => sum + (1 / b.patientCount), 0);
      }
    });

    const remainingCapacity = totalNurses - usedCapacity;
    
    // If no remaining nursing capacity (less than what's needed for a 1:3 patient)
    if (remainingCapacity < 0.33) {
      return ['No capacity - all nurses at maximum workload'];
    }

    // Calculate what could be admitted (limited by both nursing capacity and available beds)
    const capacityOptions = [];
    
    // Check 1:1 capacity
    if (remainingCapacity >= 1) {
      const nursesFor1to1 = Math.floor(remainingCapacity);
      const actual1to1 = Math.min(nursesFor1to1, availableBeds);
      if (actual1to1 > 0) {
        capacityOptions.push(`${actual1to1} × 1:1 patient${actual1to1 > 1 ? 's' : ''}`);
      }
    }
    
    // Check 1:2 capacity
    if (remainingCapacity >= 0.5) {
      const nursesFor1to2 = Math.floor(remainingCapacity / 0.5);
      const actual1to2 = Math.min(nursesFor1to2, availableBeds);
      if (actual1to2 > 0) {
        capacityOptions.push(`${actual1to2} × 1:2 patient${actual1to2 > 1 ? 's' : ''}`);
      }
    }
    
    // Check 1:3 capacity
    if (remainingCapacity >= 0.33) {
      const nursesFor1to3 = Math.floor(remainingCapacity / 0.33);
      const actual1to3 = Math.min(nursesFor1to3, availableBeds);
      if (actual1to3 > 0) {
        capacityOptions.push(`${actual1to3} × 1:3 patient${actual1to3 > 1 ? 's' : ''}`);
      }
    }

    return capacityOptions.length > 0 ? capacityOptions : ['No capacity - all nurses at maximum workload'];
  };

  // Calculate total hours for all shifts
  const calculateTotalHours = () => {
    const amNurses = parseInt(currentNursesAM) || 0;
    let totalHours = 0;
    
    // AM Shift (8 hours each)
    totalHours += amNurses * 8;
    
    // PM Shift (8 hours each)
    totalHours += expectedNursesPM * 8;
    
    // Night Shift (10 hours each)
    totalHours += expectedNursesNight * 10;
    
    // Additional roles (added once, not per shift)
    if (includeWardClerk) totalHours += 7.5;
    if (includeAM515) totalHours += 8;
    if (includeCNE) totalHours += calculateHoursFromRange(cneHours);
    
    return totalHours;
  };

  // Calculate nurse assignments
  const calculateNurses = () => {
    const assignments = [];
    let nurseId = 1;
    
    // Create working copy of beds with parsed ratios
    const bedsWithRatios = beds.map(bed => ({
      ...bed,
      patientCount: parseRatio(bed.ratio),
      nurseAssigned: null
    })).filter(bed => bed.patientCount !== null);

    // Group beds by ratio
    const groups = {
      '1': [], // 1:1 patients
      '2': [], // 1:2 patients  
      '3': []  // 1:3 patients
    };
    
    bedsWithRatios.forEach(bed => {
      if (groups[bed.patientCount]) {
        groups[bed.patientCount].push(bed);
      }
    });

    // Process 1:1 patients first (highest acuity)
    groups['1'].forEach(bed => {
      const nurse = {
        id: nurseId++,
        beds: [bed]
      };
      bed.nurseAssigned = nurse.id;
      assignments.push(nurse);
    });

    // Process 1:2 patients - group in pairs when possible
    while (groups['2'].length >= 2) {
      const nurse = {
        id: nurseId++,
        beds: []
      };
      // Assign 2 patients to this nurse
      for (let i = 0; i < 2; i++) {
        const bed = groups['2'].shift();
        bed.nurseAssigned = nurse.id;
        nurse.beds.push(bed);
      }
      assignments.push(nurse);
    }

    // Process 1:3 patients - group in threes when possible
    while (groups['3'].length >= 3) {
      const nurse = {
        id: nurseId++,
        beds: []
      };
      // Assign 3 patients to this nurse
      for (let i = 0; i < 3; i++) {
        const bed = groups['3'].shift();
        bed.nurseAssigned = nurse.id;
        nurse.beds.push(bed);
      }
      assignments.push(nurse);
    }

    // Handle remaining 1:2 and 1:3 patients
    const remaining = [...groups['2'], ...groups['3']];
    
    remaining.forEach(bed => {
      let assigned = false;
      
      // Try to find a nurse with capacity
      for (let nurse of assignments) {
        const currentLoad = nurse.beds.reduce((sum, b) => sum + (1 / b.patientCount), 0);
        const newLoad = currentLoad + (1 / bed.patientCount);
        
        if (newLoad <= 1.0) {
          nurse.beds.push(bed);
          bed.nurseAssigned = nurse.id;
          assigned = true;
          break;
        }
      }
      
      // Create new nurse if needed
      if (!assigned) {
        const nurse = {
          id: nurseId++,
          beds: [bed]
        };
        bed.nurseAssigned = nurse.id;
        assignments.push(nurse);
      }
    });

    // Update all beds with their assignments
    const updatedBeds = beds.map(bed => {
      const assignedBed = bedsWithRatios.find(b => b.id === bed.id);
      return {
        ...bed,
        nurseAssigned: assignedBed ? assignedBed.nurseAssigned : null
      };
    });

    setBeds(updatedBeds);
    setNurseAssignments(assignments);
    
    // Calculate expected nurses
    const baseNurses = assignments.length;
    const totalWithInCharge = baseNurses + (includeInCharge ? 1 : 0);
    setExpectedNursesPM(totalWithInCharge);
    setExpectedNursesNight(totalWithInCharge);
  };

  // Update bed ratio
  const updateBedRatio = (bedId, ratio) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, ratio } : bed
    ));
  };

  // Create a stable string representation of bed ratios for dependency tracking
  const bedRatiosString = beds.map(b => b.ratio).join(',');
  
  // Auto-calculate whenever relevant inputs change
  useEffect(() => {
    calculateNurses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedRatiosString, includeInCharge]);

  // Validate ratio input
  const validateRatio = (text) => {
    return text === '' || /^[0-9:]*$/.test(text);
  };

  // Validate time input
  const validateTimeInput = (text) => {
    return text === '' || /^[0-9-]*$/.test(text);
  };

  const amNurses = parseInt(currentNursesAM) || 0;
  const totalHours = calculateTotalHours();
  const pmAdmissionCapacity = calculateAdmissionCapacity(expectedNursesPM, nurseAssignments);
  const nightAdmissionCapacity = calculateAdmissionCapacity(expectedNursesNight, nurseAssignments);
  
  // Calculate total patients
  const totalPatients = beds.filter(bed => bed.ratio && parseRatio(bed.ratio) !== null).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 shadow-lg">
        <h1 className="text-4xl font-bold text-center mb-2">Hospital Nursing Calculator</h1>
        <p className="text-center text-blue-100">Calculate staffing and hours for all shifts</p>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* AM Shift Input */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            AM Shift Staffing
            {amNurses > 0 && (
              <span className="text-base font-normal text-gray-600 ml-2">
                ({amNurses} nurses = {amNurses * 8} hours)
              </span>
            )}
          </h2>
          <div className="bg-blue-50 p-4 rounded-lg max-w-xs">
            <label className="text-sm text-gray-600 block mb-2">Current AM Nurses (8hr shifts)</label>
            <input
              type="number"
              value={currentNursesAM}
              onChange={(e) => setCurrentNursesAM(e.target.value)}
              className="w-full border-2 border-blue-200 rounded-md px-3 py-2 text-2xl font-bold text-blue-700 focus:border-blue-500 focus:outline-none"
              placeholder="0"
            />
          </div>
          
          {/* Bed Occupancy Visual */}
          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-gray-600 mr-2">Bed Status:</span>
              {beds.map(bed => (
                <div
                  key={bed.id}
                  className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-all ${
                    bed.ratio ? 'bg-blue-500 text-white shadow-sm' : 'bg-white border-2 border-gray-300 text-gray-500'
                  }`}
                  title={bed.ratio ? `Bed ${bed.id}: ${bed.ratio}` : `Bed ${bed.id}: Empty`}
                >
                  {bed.id}
                </div>
              ))}
              <div className="ml-4 flex items-center gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div> Occupied
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div> Empty
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bed Input Section for PM/Night */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-2 text-gray-800">
            PM & Night Shift Ratios 
            {(expectedNursesPM > 0 || totalPatients > 0) && (
              <span className="text-base font-normal text-gray-600 ml-2">
                ({totalPatients} patient{totalPatients !== 1 ? 's' : ''}, PM: {expectedNursesPM} nurses, Night: {expectedNursesNight} nurses)
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter ratios to calculate PM (8hr) and Night (10hr) staffing
            {totalPatients === 11 && (
              <span className="text-red-600 font-semibold ml-2">(All beds full)</span>
            )}
          </p>
          
          <div className="grid gap-3 md:grid-cols-2">
            {beds.map(bed => (
              <div key={bed.id} className="bg-gray-50 p-4 rounded-lg flex items-center gap-3 hover:bg-gray-100 transition">
                <span className="font-semibold text-gray-700 w-16">Bed {bed.id}</span>
                <input
                  type="text"
                  className="flex-1 border-2 border-gray-200 rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none transition"
                  value={bed.ratio}
                  onChange={(e) => {
                    if (validateRatio(e.target.value)) {
                      updateBedRatio(bed.id, e.target.value);
                    }
                  }}
                  placeholder="1:2"
                />
                {bed.nurseAssigned && (
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-semibold shadow-sm"
                    style={{ backgroundColor: `hsl(${bed.nurseAssigned * 60}, 70%, 85%)` }}
                  >
                    Nurse {bed.nurseAssigned}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Additional Staff Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Additional Staff</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInCharge}
                onChange={(e) => setIncludeInCharge(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">In-Charge Nurse (+1 nurse for PM & Night)</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWardClerk}
                onChange={(e) => setIncludeWardClerk(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Ward Clerk (+7.5 hours)</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAM515}
                onChange={(e) => setIncludeAM515(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">AM 515 (+8 hours)</span>
            </label>
            
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCNE}
                  onChange={(e) => setIncludeCNE(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">CNE</span>
              </label>
              {includeCNE && (
                <input
                  type="text"
                  value={cneHours}
                  onChange={(e) => {
                    if (validateTimeInput(e.target.value)) {
                      setCneHours(e.target.value);
                    }
                  }}
                  placeholder="1100-2100"
                  className="border-2 border-gray-200 rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none transition"
                />
              )}
              {includeCNE && cneHours && calculateHoursFromRange(cneHours) > 0 && (
                <span className="text-sm text-gray-600">
                  ({calculateHoursFromRange(cneHours).toFixed(1)} hours)
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={calculateNurses}
              className="bg-gray-500 text-white font-medium py-2 px-4 rounded hover:bg-gray-600 transition text-sm"
            >
              Refresh Calculations
            </button>
            <p className="text-xs text-gray-500 mt-2">Calculations update automatically as you type</p>
          </div>
        </div>

        {/* Comprehensive Staffing Analysis */}
        {(amNurses > 0 || expectedNursesPM > 0 || totalPatients > 0) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              24-Hour Staffing Summary
              {totalPatients > 0 && (
                <span className="text-base font-normal text-gray-600 ml-2">
                  ({totalPatients} patient{totalPatients !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
            
            {/* Shift Summary */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">AM Shift</h3>
                <div className="text-2xl font-bold text-blue-700">{amNurses} nurses</div>
                <div className="text-sm text-gray-600 mt-1">{amNurses * 8} hours</div>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-800 mb-2">PM Shift</h3>
                <div className="text-2xl font-bold text-orange-700">{expectedNursesPM} nurses</div>
                <div className="text-sm text-gray-600 mt-1">{expectedNursesPM * 8} hours</div>
                {includeInCharge && <div className="text-xs text-gray-500">(inc. in-charge)</div>}
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">Night Shift</h3>
                <div className="text-2xl font-bold text-purple-700">{expectedNursesNight} nurses</div>
                <div className="text-sm text-gray-600 mt-1">{expectedNursesNight * 10} hours</div>
                {includeInCharge && <div className="text-xs text-gray-500">(inc. in-charge)</div>}
              </div>
            </div>

            {/* Patient Summary */}
            {totalPatients > 0 && (
              <div className={`${totalPatients === 11 ? 'bg-red-50' : 'bg-gray-50'} p-4 rounded-lg mb-6`}>
                <h3 className="font-semibold text-gray-700 mb-2">Current Patient Load</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">
                    {totalPatients} Total Patients
                    {totalPatients === 11 && <span className="text-red-600 ml-2">(Max Capacity)</span>}
                  </span>
                  <div className="text-sm text-gray-600">
                    {(() => {
                      const ratios = { '1:1': 0, '1:2': 0, '1:3': 0 };
                      beds.forEach(bed => {
                        if (bed.ratio === '1:1') ratios['1:1']++;
                        else if (bed.ratio === '1:2') ratios['1:2']++;
                        else if (bed.ratio === '1:3') ratios['1:3']++;
                      });
                      return Object.entries(ratios)
                        .filter(([_, count]) => count > 0)
                        .map(([ratio, count]) => `${count} × ${ratio}`)
                        .join(', ');
                    })()}
                  </div>
                </div>
                {totalPatients < 11 && (
                  <div className="text-sm text-gray-600 mt-2">
                    {11 - totalPatients} bed{11 - totalPatients !== 1 ? 's' : ''} available
                  </div>
                )}
                {totalPatients < 11 && totalPatients > 7 && (
                  <div className="text-xs text-orange-600 mt-3 font-medium">
                    ⚠️ Approaching maximum bed capacity ({11 - totalPatients} bed{11 - totalPatients !== 1 ? 's' : ''} remaining)
                  </div>
                )}
              </div>
            )}

            {/* Admission Capacity */}
            {(pmAdmissionCapacity || nightAdmissionCapacity) && (
              <div className={`${
                (pmAdmissionCapacity?.[0]?.startsWith('No capacity') || 
                 nightAdmissionCapacity?.[0]?.startsWith('No capacity')) 
                  ? 'bg-red-50' 
                  : 'bg-green-50'
              } p-4 rounded-lg mb-6`}>
                <h3 className={`font-semibold ${
                  (pmAdmissionCapacity?.[0]?.startsWith('No capacity') || 
                   nightAdmissionCapacity?.[0]?.startsWith('No capacity')) 
                    ? 'text-red-800' 
                    : 'text-green-800'
                } mb-3`}>Admission Capacity</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {pmAdmissionCapacity && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">PM Shift could admit:</h4>
                      <div className="text-sm text-gray-600">
                        {pmAdmissionCapacity[0].startsWith('No capacity') ? (
                          <span className="font-semibold text-red-600">{pmAdmissionCapacity[0]}</span>
                        ) : (
                          pmAdmissionCapacity.map((option, idx) => (
                            <span key={idx}>
                              {idx > 0 && <span className="font-semibold text-gray-700"> OR </span>}
                              {option}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  {nightAdmissionCapacity && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Night Shift could admit:</h4>
                      <div className="text-sm text-gray-600">
                        {nightAdmissionCapacity[0].startsWith('No capacity') ? (
                          <span className="font-semibold text-red-600">{nightAdmissionCapacity[0]}</span>
                        ) : (
                          nightAdmissionCapacity.map((option, idx) => (
                            <span key={idx}>
                              {idx > 0 && <span className="font-semibold text-gray-700"> OR </span>}
                              {option}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {totalPatients < 11 && totalPatients > 0 && 
                 !pmAdmissionCapacity?.[0]?.startsWith('No capacity') && 
                 !nightAdmissionCapacity?.[0]?.startsWith('No capacity') && (
                  <div className="text-xs text-gray-500 mt-3">
                    * Limited to {11 - totalPatients} patient{11 - totalPatients !== 1 ? 's' : ''} due to available beds
                  </div>
                )}
              </div>
            )}

            {/* Detailed Hours Breakdown */}
            <div className="bg-gray-50 p-5 rounded-lg">
              <h3 className="font-bold mb-4 text-gray-800 text-lg">24-Hour Hours Breakdown</h3>
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Nursing Hours</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>AM Shift ({amNurses} × 8 hrs):</span>
                        <span className="font-semibold">{amNurses * 8} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PM Shift ({expectedNursesPM} × 8 hrs):</span>
                        <span className="font-semibold">{expectedNursesPM * 8} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Night Shift ({expectedNursesNight} × 10 hrs):</span>
                        <span className="font-semibold">{expectedNursesNight * 10} hrs</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Additional Staff</h4>
                    <div className="space-y-1 text-sm">
                      {includeWardClerk && (
                        <div className="flex justify-between">
                          <span>Ward Clerk:</span>
                          <span className="font-semibold">7.5 hrs</span>
                        </div>
                      )}
                      {includeAM515 && (
                        <div className="flex justify-between">
                          <span>AM 515:</span>
                          <span className="font-semibold">8 hrs</span>
                        </div>
                      )}
                      {includeCNE && calculateHoursFromRange(cneHours) > 0 && (
                        <div className="flex justify-between">
                          <span>CNE ({cneHours}):</span>
                          <span className="font-semibold">{calculateHoursFromRange(cneHours).toFixed(1)} hrs</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 mt-4 border-t-2 border-gray-300">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total 24-Hour Requirement:</span>
                    <span className="text-blue-700">{totalHours.toFixed(1)} hours</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PM/Night Nurse Assignments */}
        {nurseAssignments.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">PM & Night Nurse Assignments</h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nurseAssignments.map(nurse => {
                const workload = nurse.beds.reduce((sum, bed) => sum + (1 / bed.patientCount), 0);
                return (
                  <div 
                    key={nurse.id} 
                    className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-lg shadow hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-lg text-gray-800">Nurse {nurse.id}</h3>
                      <span className={`text-sm font-semibold px-2 py-1 rounded ${
                        workload >= 0.9 ? 'bg-red-100 text-red-700' : 
                        workload >= 0.7 ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        {(workload * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      {nurse.beds.map(bed => (
                        <p key={bed.id} className="text-gray-600 text-sm">
                          • Bed {bed.id} <span className="text-gray-500">(1:{bed.patientCount})</span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {includeInCharge && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg shadow hover:shadow-md transition">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg text-purple-800">In-Charge Nurse</h3>
                    <span className="text-sm font-semibold px-2 py-1 rounded bg-purple-200 text-purple-700">
                      Supervisor
                    </span>
                  </div>
                  <p className="text-purple-600 text-sm">
                    • Overall supervision
                    <br />• Staff coordination
                    <br />• Emergency support
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NursingCalculator;