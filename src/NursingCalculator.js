import React, { useState, useEffect, useCallback } from 'react';

const NursingCalculator = () => {
  const [beds, setBeds] = useState(
    Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      ratio: '',
      status: 'current',
      newRatio: '',
      moveToBed: '',
      moveNewRatio: '',
      admissionAfterMove: '',
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
  const [viewMode, setViewMode] = useState('combined');

  const parseRatio = (ratioStr) => {
    if (!ratioStr || !ratioStr.includes(':')) return null;
    const parts = ratioStr.split(':');
    if (parts.length !== 2) return null;
    const nurseCount = parseInt(parts[0]);
    const patientCount = parseInt(parts[1]);
    if (isNaN(nurseCount) || isNaN(patientCount) || nurseCount !== 1) return null;
    return patientCount;
  };

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
    
    if (hours < 0) {
      hours += 24;
    }
    
    return hours + (minutes / 60);
  };

  const calculateTotalHours = () => {
    const amNurses = parseInt(currentNursesAM) || 0;
    let totalHours = 0;
    
    totalHours += amNurses * 8;
    totalHours += expectedNursesPM * 8;
    totalHours += expectedNursesNight * 10;
    
    if (includeWardClerk) totalHours += 7.5;
    if (includeAM515) totalHours += 8;
    if (includeCNE) totalHours += calculateHoursFromRange(cneHours);
    
    return totalHours;
  };

  const calculateNurses = useCallback(() => {
    console.log('calculateNurses function called');
    const assignments = [];
    let nurseId = 1;
    
    // First, handle bed moves
    const bedMoveMap = {};
    const newAdmissionsAfterMove = {};
    
    beds.forEach(bed => {
      if ((bed.status === 'bedMove' || bed.status === 'bedMoveWithRatio') && bed.moveToBed) {
        const targetBed = parseInt(bed.moveToBed);
        if (targetBed >= 1 && targetBed <= 11) {
          bedMoveMap[targetBed] = {
            ...bed,
            id: targetBed,
            ratio: bed.moveNewRatio || bed.newRatio || bed.ratio
          };
          
          // Check if there's a new admission coming to the vacated bed
          if (bed.admissionAfterMove) {
            newAdmissionsAfterMove[bed.id] = bed.admissionAfterMove;
          }
        }
      }
    });
    
    const bedsWithRatios = beds.map(bed => {
      // Check if another bed is moving to this position
      if (bedMoveMap[bed.id]) {
        return {
          ...bedMoveMap[bed.id],
          patientCount: parseRatio(bedMoveMap[bed.id].ratio),
          nurseAssigned: null
        };
      }
      
      // Check if this bed has a new admission after someone moved out
      if (newAdmissionsAfterMove[bed.id]) {
        return {
          ...bed,
          patientCount: parseRatio(newAdmissionsAfterMove[bed.id]),
          nurseAssigned: null
        };
      }
      
      // Handle different statuses
      if (bed.status === 'turnover' && bed.newRatio && parseRatio(bed.newRatio) !== null) {
        return {
          ...bed,
          patientCount: parseRatio(bed.newRatio),
          nurseAssigned: null
        };
      }
      if (bed.status === 'changeRatio' && bed.newRatio && parseRatio(bed.newRatio) !== null) {
        return {
          ...bed,
          patientCount: parseRatio(bed.newRatio),
          nurseAssigned: null
        };
      }
      if (bed.status === 'bedMove' || bed.status === 'bedMoveWithRatio') {
        return null; // This bed's patient has moved elsewhere
      }
      return {
        ...bed,
        patientCount: parseRatio(bed.ratio),
        nurseAssigned: null
      };
    }).filter(bed => bed !== null && bed.patientCount !== null && bed.status !== 'discharge' && bed.status !== 'toWard');

    console.log('Beds with ratios:', bedsWithRatios.map(bed => ({id: bed.id, ratio: bed.ratio, patientCount: bed.patientCount})));

    const groups = {};
    
    // Group beds by their patient count
    bedsWithRatios.forEach(bed => {
      const key = bed.patientCount.toString();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(bed);
    });

    // Sort groups by patient count (1:1 first, then 1:2, etc.)
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));

    // Assign nurses to groups optimally
    sortedGroupKeys.forEach(key => {
      const patientCount = parseInt(key);
      const bedsInGroup = groups[key];
      
      if (patientCount === 1) {
        // 1:1 patients each get their own nurse
        bedsInGroup.forEach(bed => {
          const nurse = {
            id: nurseId++,
            beds: [bed]
          };
          bed.nurseAssigned = nurse.id;
          assignments.push(nurse);
        });
      } else {
        // For 1:2, 1:3, 1:4, etc., group beds optimally
        // A nurse can handle up to 'patientCount' beds of this ratio
        while (bedsInGroup.length > 0) {
          const nurse = {
            id: nurseId++,
            beds: []
          };
          
          // Assign up to 'patientCount' beds to this nurse
          for (let i = 0; i < patientCount && bedsInGroup.length > 0; i++) {
            const bed = bedsInGroup.shift();
            bed.nurseAssigned = nurse.id;
            nurse.beds.push(bed);
          }
          assignments.push(nurse);
        }
      }
    });

    const updatedBeds = beds.map(bed => {
      const assignedBed = bedsWithRatios.find(b => b.id === bed.id);
      return {
        ...bed,
        nurseAssigned: assignedBed ? assignedBed.nurseAssigned : null
      };
    });

    // Debug logging
    console.log('Nurse assignments:', assignments.map(nurse => ({
      id: nurse.id,
      beds: nurse.beds.map(bed => `B${bed.id}(${bed.ratio})`)
    })));
    console.log('Updated beds:', updatedBeds.filter(bed => bed.ratio).map(bed => ({
      id: bed.id,
      ratio: bed.ratio,
      nurseAssigned: bed.nurseAssigned
    })));
    
    setBeds(updatedBeds);
    setNurseAssignments(assignments);
    
    const baseNurses = assignments.length;
    const totalWithInCharge = baseNurses + (includeInCharge ? 1 : 0);
    setExpectedNursesPM(totalWithInCharge);
    setExpectedNursesNight(totalWithInCharge);
  }, [beds, includeInCharge]);

  const updateBedRatio = (bedId, ratio) => {
    console.log('updateBedRatio called:', bedId, ratio);
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, ratio } : bed
    ));
    // Force calculation after updating ratio
    setTimeout(() => calculateNurses(), 100);
  };

  const updateNewRatio = (bedId, newRatio) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, newRatio } : bed
    ));
  };

  const updateBedStatus = (bedId, status) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { 
        ...bed, 
        status, 
        newRatio: (status !== 'turnover' && status !== 'changeRatio') ? '' : bed.newRatio,
        moveToBed: (status !== 'bedMove' && status !== 'bedMoveWithRatio') ? '' : bed.moveToBed,
        moveNewRatio: status !== 'bedMoveWithRatio' ? '' : bed.moveNewRatio,
        admissionAfterMove: (status !== 'bedMove' && status !== 'bedMoveWithRatio') ? '' : bed.admissionAfterMove
      } : bed
    ));
  };

  const updateMoveToBed = (bedId, moveToBed) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, moveToBed } : bed
    ));
  };

  const updateMoveNewRatio = (bedId, moveNewRatio) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, moveNewRatio } : bed
    ));
  };

  const updateAdmissionAfterMove = (bedId, admissionAfterMove) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, admissionAfterMove } : bed
    ));
  };

  const validateRatio = (text) => {
    if (text === '') return true;
    // Allow formats like 1:1, 1:2, 1:3, 1:4, etc.
    const pattern = /^1:[1-9]\d*$/;
    return pattern.test(text) || /^[0-9:]*$/.test(text);
  };

  const validateTimeInput = (text) => {
    return text === '' || /^[0-9-]*$/.test(text);
  };

  const calculateAdmissionCapacity = (nurses, currentAssignments) => {
    const totalNurses = nurses - (includeInCharge ? 1 : 0);
    if (totalNurses <= 0) return ['No capacity - no bedside nurses available'];

    const currentOccupiedBeds = beds.filter(bed => 
      bed.ratio && parseRatio(bed.ratio) !== null && bed.status !== 'discharge' && bed.status !== 'toWard' && bed.status !== 'bedMove' && bed.status !== 'bedMoveWithRatio'
    ).length;
    
    const plannedDischarges = beds.filter(bed => 
      bed.ratio && parseRatio(bed.ratio) !== null && (bed.status === 'discharge' || bed.status === 'toWard')
    ).length;
    
    const effectiveOccupiedBeds = currentOccupiedBeds;
    const availableBeds = 11 - effectiveOccupiedBeds;
    
    if (availableBeds <= 0) {
      return ['No capacity - all beds occupied (after planned movements)'];
    }

    let usedCapacity = 0;
    const activeAssignments = currentAssignments.map(nurse => ({
      ...nurse,
      beds: nurse.beds.filter(bed => {
        const actualBed = beds.find(b => b.id === bed.id);
        return actualBed && actualBed.status !== 'discharge' && actualBed.status !== 'toWard' && actualBed.status !== 'bedMove' && actualBed.status !== 'bedMoveWithRatio';
      }).map(bed => {
        const actualBed = beds.find(b => b.id === bed.id);
        if (actualBed && actualBed.status === 'turnover' && actualBed.newRatio) {
          const newPatientCount = parseRatio(actualBed.newRatio);
          if (newPatientCount) {
            return { ...bed, patientCount: newPatientCount };
          }
        }
        return bed;
      })
    }));

    activeAssignments.forEach(nurse => {
      if (nurse.beds && nurse.beds.length > 0) {
        usedCapacity += nurse.beds.reduce((sum, b) => sum + (1 / b.patientCount), 0);
      }
    });

    const remainingCapacity = totalNurses - usedCapacity;
    
    if (remainingCapacity < 0.33) {
      return ['No capacity - all nurses at maximum workload'];
    }

    const capacityOptions = [];
    
    if (remainingCapacity >= 1) {
      const nursesFor1to1 = Math.floor(remainingCapacity);
      const actual1to1 = Math.min(nursesFor1to1, availableBeds);
      if (actual1to1 > 0) {
        capacityOptions.push(`${actual1to1} × 1:1 patient${actual1to1 > 1 ? 's' : ''}`);
      }
    }
    
    if (remainingCapacity >= 0.5) {
      const nursesFor1to2 = Math.floor(remainingCapacity / 0.5);
      const actual1to2 = Math.min(nursesFor1to2, availableBeds);
      if (actual1to2 > 0) {
        capacityOptions.push(`${actual1to2} × 1:2 patient${actual1to2 > 1 ? 's' : ''}`);
      }
    }
    
    if (remainingCapacity >= 0.33) {
      const nursesFor1to3 = Math.floor(remainingCapacity / 0.33);
      const actual1to3 = Math.min(nursesFor1to3, availableBeds);
      if (actual1to3 > 0) {
        capacityOptions.push(`${actual1to3} × 1:3 patient${actual1to3 > 1 ? 's' : ''}`);
      }
    }
    
    // Support for 1:4 and beyond
    if (remainingCapacity >= 0.25) {
      const nursesFor1to4 = Math.floor(remainingCapacity / 0.25);
      const actual1to4 = Math.min(nursesFor1to4, availableBeds);
      if (actual1to4 > 0) {
        capacityOptions.push(`${actual1to4} × 1:4 patient${actual1to4 > 1 ? 's' : ''}`);
      }
    }

    return capacityOptions.length > 0 ? capacityOptions : ['No capacity - all nurses at maximum workload'];
  };

  const bedDataString = beds.map(b => `${b.ratio}:${b.status}:${b.newRatio}:${b.moveToBed}:${b.moveNewRatio}:${b.admissionAfterMove}`).join(',');
  
  useEffect(() => {
    calculateNurses();
  }, [bedDataString, includeInCharge, calculateNurses]);

  const amNurses = parseInt(currentNursesAM) || 0;
  const totalHours = calculateTotalHours();
  const pmAdmissionCapacity = calculateAdmissionCapacity(expectedNursesPM, nurseAssignments);
  const nightAdmissionCapacity = calculateAdmissionCapacity(expectedNursesNight, nurseAssignments);
  
  // Current state calculations
  const currentPatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && (bed.status === 'current' || bed.status === 'toWard')
  ).length;
  const toWardPatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'toWard'
  ).length;
  
  // Expected state calculations
  const comingInPatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'comingIn'
  ).length;
  const dischargePatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'discharge'
  ).length;
  const turnoverBeds = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'turnover'
  ).length;
  
  const totalPatients = beds.filter(bed => bed.ratio && parseRatio(bed.ratio) !== null).length;
  const remainingAfterWard = currentPatients - toWardPatients;
  const expectedFinalPatients = remainingAfterWard + comingInPatients + turnoverBeds;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400 text-center tracking-tight">
            Nursing Calculator
          </h1>
          <p className="text-center text-zinc-400 mt-2 text-sm uppercase tracking-wider">Advanced Shift Planning System</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* AM Shift Input */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl"></div>
          <h2 className="text-2xl font-bold mb-6 text-zinc-100 flex items-center relative z-10">
            <span className="w-3 h-3 bg-cyan-400 rounded-full mr-3 animate-pulse"></span>
            Morning Shift
          </h2>
          <div className="flex items-center gap-6 relative z-10">
            <div className="bg-zinc-800/50 backdrop-blur border border-zinc-700 p-6 rounded-xl flex-1 max-w-sm">
              <label className="text-xs text-zinc-400 font-medium block mb-3 uppercase tracking-wider">AM Nurses (8hr)</label>
              <input
                type="number"
                value={currentNursesAM}
                onChange={(e) => setCurrentNursesAM(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-6 py-4 text-3xl font-bold text-cyan-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                placeholder="0"
              />
            </div>
            {amNurses > 0 && (
              <div className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 p-6 rounded-xl">
                <p className="text-zinc-400 text-xs uppercase tracking-wider">Total Hours</p>
                <p className="text-4xl font-black text-cyan-400">{amNurses * 8}</p>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-center gap-4">
            <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">View Mode</span>
            <div className="bg-zinc-800 rounded-full p-1 flex">
              <button
                onClick={() => setViewMode('combined')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'combined' 
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg shadow-cyan-500/25' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'split' 
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg shadow-violet-500/25' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Current → Expected
              </button>
            </div>
          </div>
        </div>

        {/* Bed Input Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-violet-500/10 to-transparent rounded-full blur-3xl"></div>
          <h2 className="text-2xl font-bold mb-6 text-zinc-100 relative z-10">
            {viewMode === 'split' ? 'Bed Status & Changes' : 'PM & Night Planning'}
          </h2>
          
          <button 
            onClick={() => {
              console.log('Manual calculation button clicked');
              calculateNurses();
            }}
            className="mb-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            DEBUG: Manual Calculate
          </button>
          
          {viewMode === 'split' && (
            <div className="mb-8 grid md:grid-cols-2 gap-4 relative z-10">
              <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 p-6 rounded-xl">
                <h3 className="font-bold text-blue-400 mb-2 text-sm uppercase tracking-wider">Current</h3>
                <p className="text-4xl font-black text-blue-400">{currentPatients}</p>
                <p className="text-zinc-400 text-sm">patients now</p>
                {toWardPatients > 0 && (
                  <p className="text-orange-400 text-sm mt-2">-{toWardPatients} to ward</p>
                )}
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 p-6 rounded-xl">
                <h3 className="font-bold text-green-400 mb-2 text-sm uppercase tracking-wider">Expected</h3>
                <p className="text-4xl font-black text-green-400">{expectedFinalPatients}</p>
                <p className="text-zinc-400 text-sm">final count</p>
                <p className="text-violet-400 text-sm mt-2 font-medium">
                  {expectedNursesPM} nurses needed
                </p>
              </div>
            </div>
          )}
          
          <div className="grid gap-3 md:grid-cols-2 relative z-10">
            {beds.map(bed => (
              <div key={bed.id} className="bg-zinc-800/50 backdrop-blur border border-zinc-700 p-4 rounded-xl hover:border-zinc-600 transition-all">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-lg font-bold text-zinc-400 text-sm">
                      B{bed.id}
                    </span>
                    <input
                      type="text"
                      className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm"
                      value={bed.ratio}
                      onChange={(e) => {
                        if (validateRatio(e.target.value)) {
                          updateBedRatio(bed.id, e.target.value);
                        }
                      }}
                      placeholder="1:2"
                    />
                    {bed.ratio && (
                      <select
                        value={bed.status}
                        onChange={(e) => updateBedStatus(bed.id, e.target.value)}
                        className={`bg-zinc-900/50 border rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                          bed.status === 'discharge' ? 'border-red-500/50 text-red-400' :
                          bed.status === 'turnover' ? 'border-purple-500/50 text-purple-400' :
                          bed.status === 'toWard' ? 'border-orange-500/50 text-orange-400' :
                          bed.status === 'comingIn' ? 'border-green-500/50 text-green-400' :
                          bed.status === 'changeRatio' ? 'border-blue-500/50 text-blue-400' :
                          bed.status === 'bedMove' ? 'border-indigo-500/50 text-indigo-400' :
                          bed.status === 'bedMoveWithRatio' ? 'border-pink-500/50 text-pink-400' :
                          'border-zinc-700 text-zinc-400'
                        }`}
                      >
                        <option value="current">Staying</option>
                        <option value="changeRatio">Ratio Change</option>
                        <option value="bedMove">Moving Beds</option>
                        <option value="bedMoveWithRatio">Move + Ratio</option>
                        <option value="toWard">To Ward</option>
                        <option value="comingIn">New Admission</option>
                        <option value="discharge">Discharge</option>
                        <option value="turnover">Turnover</option>
                      </select>
                    )}
                    {bed.nurseAssigned && bed.status !== 'toWard' && bed.status !== 'discharge' && bed.status !== 'bedMove' && bed.status !== 'bedMoveWithRatio' && (
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r text-zinc-900"
                        style={{ 
                          backgroundImage: `linear-gradient(135deg, hsl(${bed.nurseAssigned * 60}, 70%, 60%), hsl(${bed.nurseAssigned * 60 + 30}, 70%, 50%))`
                        }}
                      >
                        N{bed.nurseAssigned}
                      </span>
                    )}
                  </div>
                  {bed.status === 'turnover' && (
                    <div className="flex items-center gap-2 ml-12">
                      <span className="text-xs text-purple-400">New:</span>
                      <input
                        type="text"
                        className="flex-1 bg-zinc-900/50 border border-purple-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                        value={bed.newRatio}
                        onChange={(e) => {
                          if (validateRatio(e.target.value)) {
                            updateNewRatio(bed.id, e.target.value);
                          }
                        }}
                        placeholder="1:2"
                      />
                    </div>
                  )}
                  {bed.status === 'changeRatio' && (
                    <div className="flex items-center gap-2 ml-12">
                      <span className="text-xs text-blue-400">New:</span>
                      <input
                        type="text"
                        className="flex-1 bg-zinc-900/50 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                        value={bed.newRatio}
                        onChange={(e) => {
                          if (validateRatio(e.target.value)) {
                            updateNewRatio(bed.id, e.target.value);
                          }
                        }}
                        placeholder="1:1"
                      />
                    </div>
                  )}
                  {bed.status === 'bedMove' && (
                    <div className="flex flex-col gap-2 ml-12">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-indigo-400">To:</span>
                        <select
                          value={bed.moveToBed}
                          onChange={(e) => updateMoveToBed(bed.id, e.target.value)}
                          className="bg-zinc-900/50 border border-indigo-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100"
                        >
                          <option value="">Select...</option>
                          {Array.from({ length: 11 }, (_, i) => i + 1)
                            .filter(num => num !== bed.id && !beds.find(b => b.id !== bed.id && b.moveToBed === String(num)))
                            .map(num => (
                              <option key={num} value={num}>Bed {num}</option>
                            ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-indigo-400">New:</span>
                        <input
                          type="text"
                          className="flex-1 bg-zinc-900/50 border border-indigo-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100"
                          value={bed.admissionAfterMove}
                          onChange={(e) => {
                            if (validateRatio(e.target.value)) {
                              updateAdmissionAfterMove(bed.id, e.target.value);
                            }
                          }}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  )}
                  {bed.status === 'bedMoveWithRatio' && (
                    <div className="flex flex-col gap-2 ml-12">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-pink-400">To:</span>
                        <select
                          value={bed.moveToBed}
                          onChange={(e) => updateMoveToBed(bed.id, e.target.value)}
                          className="bg-zinc-900/50 border border-pink-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100"
                        >
                          <option value="">Select...</option>
                          {Array.from({ length: 11 }, (_, i) => i + 1)
                            .filter(num => num !== bed.id && !beds.find(b => b.id !== bed.id && b.moveToBed === String(num)))
                            .map(num => (
                              <option key={num} value={num}>Bed {num}</option>
                            ))}
                        </select>
                        <span className="text-xs text-pink-400">@</span>
                        <input
                          type="text"
                          className="w-16 bg-zinc-900/50 border border-pink-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100"
                          value={bed.moveNewRatio}
                          onChange={(e) => {
                            if (validateRatio(e.target.value)) {
                              updateMoveNewRatio(bed.id, e.target.value);
                            }
                          }}
                          placeholder="1:1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-pink-400">New:</span>
                        <input
                          type="text"
                          className="flex-1 bg-zinc-900/50 border border-pink-500/30 rounded-lg px-2 py-1 text-xs text-zinc-100"
                          value={bed.admissionAfterMove}
                          onChange={(e) => {
                            if (validateRatio(e.target.value)) {
                              updateAdmissionAfterMove(bed.id, e.target.value);
                            }
                          }}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Bed Occupancy Visual */}
          <div className="mt-6 bg-zinc-800/30 border border-zinc-700 p-4 rounded-xl relative z-10">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mr-3">Status</span>
              {beds.map(bed => {
                const isOccupied = bed.ratio && parseRatio(bed.ratio) !== null;
                const isDischarged = bed.status === 'discharge';
                const isToWard = bed.status === 'toWard';
                const isAdmission = bed.status === 'comingIn';
                const isTurnover = bed.status === 'turnover';
                const isChangeRatio = bed.status === 'changeRatio';
                const isBedMove = bed.status === 'bedMove';
                const isBedMoveWithRatio = bed.status === 'bedMoveWithRatio';
                
                return (
                  <div
                    key={bed.id}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all border ${
                      !isOccupied ? 'bg-zinc-900 border-zinc-700 text-zinc-600' :
                      isDischarged ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                      isToWard ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' :
                      isTurnover ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' :
                      isAdmission ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                      isChangeRatio ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
                      isBedMove ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' :
                      isBedMoveWithRatio ? 'bg-pink-500/20 border-pink-500/50 text-pink-400' :
                      'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    }`}
                    title={
                      !isOccupied ? `Bed ${bed.id}: Empty` :
                      `Bed ${bed.id}: ${bed.ratio}${
                        isDischarged ? ' (Discharge)' :
                        isToWard ? ' (To Ward)' :
                        isTurnover ? ` (Turnover → ${bed.newRatio || '?'})` :
                        isAdmission ? ' (New Admission)' :
                        isChangeRatio ? ` (${bed.ratio} → ${bed.newRatio || '?'})` :
                        isBedMove ? ` (→ Bed ${bed.moveToBed || '?'}${bed.admissionAfterMove ? ', +new' : ''})` :
                        isBedMoveWithRatio ? ` (→ Bed ${bed.moveToBed || '?'} @ ${bed.moveNewRatio || '?'}${bed.admissionAfterMove ? ', +new' : ''})` : ''
                      }`
                    }
                  >
                    {bed.id}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Additional Staff Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-zinc-100 flex items-center">
            <span className="w-3 h-3 bg-violet-400 rounded-full mr-3"></span>
            Additional Staff
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-4 p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl hover:border-zinc-600 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={includeInCharge}
                onChange={(e) => setIncludeInCharge(e.target.checked)}
                className="w-5 h-5 text-cyan-500 bg-zinc-800 border-zinc-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-zinc-300">In-Charge Nurse</span>
              <span className="text-xs text-zinc-500 ml-auto">+1 nurse PM/Night</span>
            </label>
            
            <label className="flex items-center gap-4 p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl hover:border-zinc-600 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={includeWardClerk}
                onChange={(e) => setIncludeWardClerk(e.target.checked)}
                className="w-5 h-5 text-cyan-500 bg-zinc-800 border-zinc-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-zinc-300">Ward Clerk</span>
              <span className="text-xs text-zinc-500 ml-auto">+7.5 hours</span>
            </label>
            
            <label className="flex items-center gap-4 p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl hover:border-zinc-600 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={includeAM515}
                onChange={(e) => setIncludeAM515(e.target.checked)}
                className="w-5 h-5 text-cyan-500 bg-zinc-800 border-zinc-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-zinc-300">AM 515</span>
              <span className="text-xs text-zinc-500 ml-auto">+8 hours</span>
            </label>
            
            <div className="flex items-center gap-4 p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl">
              <label className="flex items-center gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCNE}
                  onChange={(e) => setIncludeCNE(e.target.checked)}
                  className="w-5 h-5 text-cyan-500 bg-zinc-800 border-zinc-600 rounded focus:ring-cyan-500"
                />
                <span className="font-medium text-zinc-300">CNE</span>
              </label>
              {includeCNE && (
                <>
                  <input
                    type="text"
                    value={cneHours}
                    onChange={(e) => {
                      if (validateTimeInput(e.target.value)) {
                        setCneHours(e.target.value);
                      }
                    }}
                    placeholder="1100-2100"
                    className="bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none ml-auto"
                  />
                  {cneHours && calculateHoursFromRange(cneHours) > 0 && (
                    <span className="text-xs text-zinc-500">
                      {calculateHoursFromRange(cneHours).toFixed(1)}h
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {(amNurses > 0 || expectedNursesPM > 0 || totalPatients > 0) && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/5 to-transparent rounded-full blur-3xl"></div>
            <h2 className="text-2xl font-bold mb-6 text-zinc-100 relative z-10">
              24-Hour Summary
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8 relative z-10">
              <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 p-6 rounded-xl">
                <h3 className="font-bold text-blue-400 mb-3 text-sm uppercase tracking-wider flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  AM Shift
                </h3>
                <div className="text-4xl font-black text-blue-400">{amNurses}</div>
                <div className="text-sm text-zinc-400 mt-1">× 8h = {amNurses * 8}h</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 p-6 rounded-xl">
                <h3 className="font-bold text-orange-400 mb-3 text-sm uppercase tracking-wider flex items-center">
                  <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                  PM Shift
                </h3>
                <div className="text-4xl font-black text-orange-400">{expectedNursesPM}</div>
                <div className="text-sm text-zinc-400 mt-1">× 8h = {expectedNursesPM * 8}h</div>
                {includeInCharge && <div className="text-xs text-zinc-500 mt-1">(inc. in-charge)</div>}
              </div>
              
              <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 p-6 rounded-xl">
                <h3 className="font-bold text-purple-400 mb-3 text-sm uppercase tracking-wider flex items-center">
                  <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                  Night Shift
                </h3>
                <div className="text-4xl font-black text-purple-400">{expectedNursesNight}</div>
                <div className="text-sm text-zinc-400 mt-1">× 10h = {expectedNursesNight * 10}h</div>
                {includeInCharge && <div className="text-xs text-zinc-500 mt-1">(inc. in-charge)</div>}
              </div>
            </div>

            <div className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 p-6 rounded-xl relative z-10">
              <h3 className="font-bold mb-4 text-zinc-100 text-lg">Total Requirement</h3>
              <div className="flex justify-between items-baseline">
                <span className="text-zinc-400">24-hour total:</span>
                <span className="text-5xl font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  {totalHours.toFixed(1)}h
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nurse Assignments */}
        {nurseAssignments.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-zinc-100">PM & Night Assignments</h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nurseAssignments.map(nurse => {
                const workload = nurse.beds.reduce((sum, bed) => sum + (1 / bed.patientCount), 0);
                return (
                  <div 
                    key={nurse.id} 
                    className="bg-zinc-800/50 backdrop-blur border border-zinc-700 p-5 rounded-xl hover:border-zinc-600 transition-all"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-zinc-100">Nurse {nurse.id}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        workload >= 0.9 ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 
                        workload >= 0.7 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 
                        'bg-green-500/20 text-green-400 border border-green-500/50'
                      }`}>
                        {(workload * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {nurse.beds.map(bed => {
                        const actualBed = beds.find(b => b.id === bed.id);
                        const displayRatio = actualBed?.status === 'turnover' && actualBed.newRatio 
                          ? parseRatio(actualBed.newRatio) 
                          : bed.patientCount;
                        return (
                          <p key={bed.id} className="text-zinc-400 text-sm flex items-center">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full mr-2"></span>
                            Bed {bed.id} 
                            <span className="text-zinc-500 ml-2">
                              1:{displayRatio}
                              {actualBed?.status === 'turnover' && ' [new]'}
                              {actualBed?.status === 'comingIn' && ' [adm]'}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {includeInCharge && (
                <div className="bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 p-5 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-violet-400">In-Charge</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-500/20 text-violet-400 border border-violet-500/50">
                      Lead
                    </span>
                  </div>
                  <div className="space-y-2 text-violet-400/80 text-sm">
                    <p className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2"></span>
                      Supervision
                    </p>
                    <p className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2"></span>
                      Coordination
                    </p>
                    <p className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2"></span>
                      Emergency
                    </p>
                  </div>
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