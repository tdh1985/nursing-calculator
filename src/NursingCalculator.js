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
      newAdmissionAfterWard: '',
      nurseAssigned: null,
      pmNightNurseAssigned: null
    }))
  );
  
  const [nurseAssignments, setNurseAssignments] = useState([]);
  const [pmNightAssignments, setPmNightAssignments] = useState([]);
  const [includeInCharge, setIncludeInCharge] = useState(true);
  const [includeWardClerk, setIncludeWardClerk] = useState(false);
  const [includeAM515, setIncludeAM515] = useState(false);
  const [includeCNE, setIncludeCNE] = useState(false);
  const [cneHours, setCneHours] = useState('');
  const [expectedNursesAM, setExpectedNursesAM] = useState(0);
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
    let totalHours = 0;
    
    totalHours += expectedNursesAM * 8;
    totalHours += expectedNursesPM * 8;
    totalHours += expectedNursesNight * 10;
    
    if (includeWardClerk) totalHours += 7.5;
    if (includeAM515) totalHours += 8;
    if (includeCNE) totalHours += calculateHoursFromRange(cneHours);
    
    return totalHours;
  };

  const calculateNurses = useCallback(() => {
    const assignments = [];
    let nurseId = 1;
    
    // First, handle bed moves and ward transfers
    const bedMoveMap = {};
    const newAdmissionsAfterMove = {};
    const wardTransferBeds = [];
    
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
      
      // Track beds with ward transfers
      if (bed.status === 'toWard' && bed.ratio && parseRatio(bed.ratio) !== null) {
        wardTransferBeds.push(bed);
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


    const groups = {};
    
    // Group beds by their patient count
    bedsWithRatios.forEach(bed => {
      const key = bed.patientCount.toString();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(bed);
    });

    // Groups are processed in priority order: 1:1, then 1:2, then 1:3

    // Use the original working logic from the user's code
    const groupsCopy = {
      '1': groups['1'] ? [...groups['1']] : [],
      '2': groups['2'] ? [...groups['2']] : [],
      '3': groups['3'] ? [...groups['3']] : []
    };

    // 1:1 patients each get their own nurse
    groupsCopy['1'].forEach(bed => {
      const nurse = {
        id: nurseId++,
        beds: [bed]
      };
      bed.nurseAssigned = nurse.id;
      assignments.push(nurse);
    });

    // Group 1:2 patients (2 per nurse)
    while (groupsCopy['2'].length >= 2) {
      const nurse = {
        id: nurseId++,
        beds: []
      };
      for (let i = 0; i < 2; i++) {
        const bed = groupsCopy['2'].shift();
        bed.nurseAssigned = nurse.id;
        nurse.beds.push(bed);
      }
      assignments.push(nurse);
    }

    // Group 1:3 patients (3 per nurse)
    while (groupsCopy['3'].length >= 3) {
      const nurse = {
        id: nurseId++,
        beds: []
      };
      for (let i = 0; i < 3; i++) {
        const bed = groupsCopy['3'].shift();
        bed.nurseAssigned = nurse.id;
        nurse.beds.push(bed);
      }
      assignments.push(nurse);
    }

    // Handle remaining patients by assigning them to existing nurses with capacity
    const remaining = [...groupsCopy['2'], ...groupsCopy['3']];
    
    remaining.forEach(bed => {
      let assigned = false;
      
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
      
      if (!assigned) {
        const nurse = {
          id: nurseId++,
          beds: [bed]
        };
        bed.nurseAssigned = nurse.id;
        assignments.push(nurse);
      }
    });

    const updatedBeds = beds.map(bed => {
      const assignedBed = bedsWithRatios.find(b => b.id === bed.id);
      return {
        ...bed,
        nurseAssigned: assignedBed ? assignedBed.nurseAssigned : null,
        pmNightNurseAssigned: bed.pmNightNurseAssigned // Keep existing PM/Night assignment
      };
    });

    
    // Don't set beds here, wait until PM/Night assignments are calculated
    setNurseAssignments(assignments);
    
    // Calculate nurses for different shifts
    // AM shift: includes current patients and those going to ward
    const baseNurses = assignments.length;
    const amTotalWithInCharge = baseNurses + (includeInCharge ? 1 : 0);
    setExpectedNursesAM(amTotalWithInCharge);
    
    // For PM/Night shifts, we need to recalculate based on:
    // 1. Removing patients going to ward
    // 2. Adding new admissions after ward transfers
    // 3. Keeping all other patient movements
    
    // Build PM/Night bed configuration
    const pmNightBeds = beds.map(bed => {
      // If patient is going to ward and there's a new admission
      if (bed.status === 'toWard' && bed.newAdmissionAfterWard) {
        return {
          ...bed,
          ratio: bed.newAdmissionAfterWard,
          status: 'current' // Treat as current for PM/Night
        };
      }
      // If patient is going to ward but no new admission, bed becomes empty
      if (bed.status === 'toWard') {
        return {
          ...bed,
          ratio: '',
          status: 'current'
        };
      }
      // Keep all other beds as they are
      return bed;
    });
    
    // Calculate PM/Night nurses using the same algorithm
    const pmNightAssignments = [];
    let pmNurseId = 1;
    
    // Process PM/Night beds through the same logic
    const pmBedsWithRatios = pmNightBeds
      .filter(bed => bed.ratio && parseRatio(bed.ratio) !== null && bed.status !== 'discharge')
      .map(bed => ({
        ...bed,
        patientCount: parseRatio(bed.ratio),
        nurseAssigned: null
      }));
    
    const pmGroups = {
      '1': pmBedsWithRatios.filter(bed => bed.patientCount === 1),
      '2': pmBedsWithRatios.filter(bed => bed.patientCount === 2),
      '3': pmBedsWithRatios.filter(bed => bed.patientCount === 3)
    };
    
    // Create optimal assignments with workload balancing
    const allPmBeds = [...pmGroups['1'], ...pmGroups['2'], ...pmGroups['3']];
    
    // Sort beds by patient count (1:1 first, then 1:2, then 1:3)
    allPmBeds.sort((a, b) => a.patientCount - b.patientCount);
    
    // Assign 1:1 patients first (they must have their own nurse)
    pmGroups['1'].forEach(bed => {
      pmNightAssignments.push({ 
        id: pmNurseId++, 
        beds: [bed],
        workload: 1.0 // 100% workload
      });
    });
    
    // For 1:2 and 1:3 patients, use a balanced assignment approach
    const unassignedBeds = [...pmGroups['2'], ...pmGroups['3']];
    
    // Create nurses for remaining beds with optimal grouping
    while (unassignedBeds.length > 0) {
      const nurse = { id: pmNurseId++, beds: [], workload: 0 };
      
      // Try to assign beds to reach optimal workload (close to 1.0)
      for (let i = unassignedBeds.length - 1; i >= 0; i--) {
        const bed = unassignedBeds[i];
        const bedWorkload = 1 / bed.patientCount;
        
        if (nurse.workload + bedWorkload <= 1.0) {
          nurse.beds.push(bed);
          nurse.workload += bedWorkload;
          unassignedBeds.splice(i, 1);
          
          // If workload is at or near 1.0, stop adding beds
          if (nurse.workload >= 0.95) break;
        }
      }
      
      if (nurse.beds.length > 0) {
        pmNightAssignments.push(nurse);
      }
    }
    
    // Update beds with PM/Night nurse assignments
    const finalBeds = updatedBeds.map(bed => {
      // Find PM/Night assignment for this bed
      let pmNightNurse = null;
      
      // Check all PM/Night assignments, not just ward transfers
      pmNightAssignments.forEach(nurse => {
        nurse.beds.forEach(assignedBed => {
          if (assignedBed.id === bed.id) {
            pmNightNurse = nurse.id;
          }
        });
      });
      
      // Special handling for ward transfers with new admissions
      if (bed.status === 'toWard' && bed.newAdmissionAfterWard && pmNightNurse) {
        // This nurse will handle the new admission in PM/Night
        return {
          ...bed,
          pmNightNurseAssigned: pmNightNurse
        };
      }
      
      return {
        ...bed,
        pmNightNurseAssigned: bed.status === 'toWard' ? null : pmNightNurse
      };
    });
    
    setBeds(finalBeds);
    setNurseAssignments(assignments);
    
    const pmNightBaseNurses = pmNightAssignments.length;
    const pmNightTotalWithInCharge = pmNightBaseNurses + (includeInCharge ? 1 : 0);
    setExpectedNursesPM(pmNightTotalWithInCharge);
    setExpectedNursesNight(pmNightTotalWithInCharge);
    
    // Store PM/Night assignments for admission capacity calculation
    setPmNightAssignments(pmNightAssignments);
  }, [beds, includeInCharge]);

  const updateBedRatio = (bedId, ratio) => {
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
        admissionAfterMove: (status !== 'bedMove' && status !== 'bedMoveWithRatio') ? '' : bed.admissionAfterMove,
        newAdmissionAfterWard: status !== 'toWard' ? '' : bed.newAdmissionAfterWard
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

  const updateNewAdmissionAfterWard = (bedId, newAdmissionAfterWard) => {
    setBeds(beds.map(bed => 
      bed.id === bedId ? { ...bed, newAdmissionAfterWard } : bed
    ));
  };

  const validateRatio = (text) => {
    if (text === '') return true;
    // Allow partial input while typing (just numbers and colons)
    // This allows: "1", "1:", "1:1", "1:2", etc.
    return /^[0-9:]*$/.test(text);
  };

  const validateTimeInput = (text) => {
    return text === '' || /^[0-9-]*$/.test(text);
  };

  const calculateAdmissionCapacity = (nurses, currentAssignments, bedsConfig = beds) => {
    const totalNurses = nurses - (includeInCharge ? 1 : 0);
    if (totalNurses <= 0) return ['No capacity - no bedside nurses available'];

    const currentOccupiedBeds = bedsConfig.filter(bed => 
      bed.ratio && parseRatio(bed.ratio) !== null && bed.status !== 'discharge' && bed.status !== 'toWard' && bed.status !== 'bedMove' && bed.status !== 'bedMoveWithRatio'
    ).length;
    
    // const plannedDischarges = beds.filter(bed => 
    //   bed.ratio && parseRatio(bed.ratio) !== null && (bed.status === 'discharge' || bed.status === 'toWard')
    // ).length;
    
    const effectiveOccupiedBeds = currentOccupiedBeds;
    const availableBeds = 11 - effectiveOccupiedBeds;
    
    if (availableBeds <= 0) {
      return ['No capacity - all beds occupied (after planned movements)'];
    }

    const activeAssignments = currentAssignments.map(nurse => ({
      ...nurse,
      beds: nurse.beds.filter(bed => {
        const actualBed = bedsConfig.find(b => b.id === bed.id);
        return actualBed && actualBed.status !== 'discharge' && actualBed.status !== 'toWard' && actualBed.status !== 'bedMove' && actualBed.status !== 'bedMoveWithRatio';
      }).map(bed => {
        const actualBed = bedsConfig.find(b => b.id === bed.id);
        if (actualBed && actualBed.status === 'turnover' && actualBed.newRatio) {
          const newPatientCount = parseRatio(actualBed.newRatio);
          if (newPatientCount) {
            return { ...bed, patientCount: newPatientCount };
          }
        }
        return bed;
      })
    }));

    // Calculate realistic admission capacity following nursing ratio rules
    // Key rules:
    // - 1:1 nurse can only handle 1 patient total
    // - 1:2 nurse can handle max 2 patients from any ratio (except 1:1)
    // - 1:3 nurse can handle max 3 patients from any ratio (but if has a 1:2, max is 2)
    // - 1:4 nurse can handle max 4 patients from any ratio (but limited by existing patients)
    const calculateDetailedCapacity = () => {
      const detailedOptions = [];
      const unassignedNurses = totalNurses - activeAssignments.filter(nurse => nurse.beds && nurse.beds.length > 0).length;
      
      // Calculate how many nurses have capacity and their limits
      let nursesWithCapacity = [];
      
      activeAssignments.forEach(nurse => {
        if (nurse.beds && nurse.beds.length > 0) {
          // Find the nurse's maximum capacity based on their current assignments
          let maxPatientCapacity = 0;
          let currentPatientCount = 0;
          
          nurse.beds.forEach(bed => {
            currentPatientCount += 1; // Each bed has 1 patient
            // The nurse's max capacity is determined by their most restrictive ratio
            if (bed.patientCount === 1) {
              maxPatientCapacity = 1; // 1:1 nurse can only have 1 patient
            } else if (maxPatientCapacity !== 1) {
              // Use the most restrictive non-1:1 ratio
              if (maxPatientCapacity === 0 || bed.patientCount < maxPatientCapacity) {
                maxPatientCapacity = bed.patientCount;
              }
            }
          });
          
          const remainingCapacity = maxPatientCapacity - currentPatientCount;
          
          if (remainingCapacity > 0) {
            nursesWithCapacity.push({
              nurse: nurse,
              currentPatientCount: currentPatientCount,
              maxPatientCapacity: maxPatientCapacity,
              remainingCapacity: remainingCapacity
            });
          }
        }
      });
      
      // Check what admissions can actually be accommodated
      const possibleAdmissions = {};
      
      // For each ratio type, check if any nurse can take it
      [1, 2, 3, 4].forEach(ratio => {
        let canAdmit = 0;
        
        nursesWithCapacity.forEach(nurseInfo => {
          // A nurse can take a patient if they have room
          // But they cannot take a 1:1 patient unless they have no patients
          if (ratio === 1 && nurseInfo.currentPatientCount === 0) {
            canAdmit++;
          } else if (ratio > 1 && nurseInfo.remainingCapacity > 0) {
            // For ratios 1:2, 1:3, 1:4, just need available capacity
            canAdmit++;
          }
        });
        
        if (canAdmit > 0 && availableBeds > 0) {
          possibleAdmissions[ratio] = Math.min(canAdmit, availableBeds);
        }
      });
      
      // Generate options based on what's actually possible
      Object.entries(possibleAdmissions).forEach(([ratio, count]) => {
        detailedOptions.push({
          text: `${count} × 1:${ratio} patient${count > 1 ? 's' : ''}`
        });
      });
      
      // Handle unassigned nurses separately
      if (unassignedNurses > 0 && availableBeds > 0) {
        // If we have no options from assigned nurses, show what unassigned nurses can do
        if (detailedOptions.length === 0) {
          [1, 2, 3, 4].forEach(ratio => {
            const nursesNeeded = Math.ceil(availableBeds / ratio);
            const nursesUsed = Math.min(nursesNeeded, unassignedNurses);
            const patientsAccommodated = Math.min(nursesUsed * ratio, availableBeds);
            
            if (patientsAccommodated > 0) {
              detailedOptions.push({
                text: `${patientsAccommodated} × 1:${ratio} patient${patientsAccommodated > 1 ? 's' : ''} (using ${nursesUsed} new nurse${nursesUsed > 1 ? 's' : ''})`
              });
            }
          });
        } else {
          // We have capacity from assigned nurses, add unassigned as additional options
          const additionalOptions = [];
          [1, 2, 3, 4].forEach(ratio => {
            const nursesNeeded = Math.ceil(availableBeds / ratio);
            const nursesUsed = Math.min(nursesNeeded, unassignedNurses);
            const patientsAccommodated = Math.min(nursesUsed * ratio, availableBeds);
            
            if (patientsAccommodated > 0) {
              additionalOptions.push(`${patientsAccommodated} × 1:${ratio} patient${patientsAccommodated > 1 ? 's' : ''} (using ${nursesUsed} new nurse${nursesUsed > 1 ? 's' : ''})`);
            }
          });
          
          // Add as "AND" options if we have them
          if (additionalOptions.length > 0) {
            additionalOptions.forEach(opt => {
              detailedOptions.push({ text: 'AND ' + opt });
            });
          }
        }
      }
      
      return detailedOptions;
    };
    
    // Get detailed capacity options
    const detailedCapacityOptions = calculateDetailedCapacity();
    
    if (detailedCapacityOptions.length === 0) {
      return ['No capacity - all nurses at maximum workload'];
    }
    
    return detailedCapacityOptions.map(option => option.text);
  };

  const bedDataString = beds.map(b => `${b.ratio}:${b.status}:${b.newRatio}:${b.moveToBed}:${b.moveNewRatio}:${b.admissionAfterMove}:${b.newAdmissionAfterWard}`).join(',');
  
  useEffect(() => {
    calculateNurses();
  }, [bedDataString, includeInCharge, calculateNurses]);

  const totalHours = calculateTotalHours();
  
  // Create PM/Night bed configuration for admission capacity calculation
  const pmNightBedsConfig = beds.map(bed => {
    // If patient is going to ward and there's a new admission
    if (bed.status === 'toWard' && bed.newAdmissionAfterWard) {
      return {
        ...bed,
        ratio: bed.newAdmissionAfterWard,
        status: 'current' // Treat as current for PM/Night
      };
    }
    // If patient is going to ward but no new admission, bed becomes empty
    if (bed.status === 'toWard') {
      return {
        ...bed,
        ratio: '',
        status: 'current'
      };
    }
    // Keep all other beds as they are
    return bed;
  });
  
  const pmAdmissionCapacity = calculateAdmissionCapacity(expectedNursesPM, pmNightAssignments, pmNightBedsConfig);
  const nightAdmissionCapacity = calculateAdmissionCapacity(expectedNursesNight, pmNightAssignments, pmNightBedsConfig);
  
  // Current state calculations
  const currentPatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'current'
  ).length;
  const toWardPatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'toWard'
  ).length;
  
  // Expected state calculations
  const comingInPatients = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'comingIn'
  ).length;
  // const dischargePatients = beds.filter(bed => 
  //   bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'discharge'
  // ).length;
  const turnoverBeds = beds.filter(bed => 
    bed.ratio && parseRatio(bed.ratio) !== null && bed.status === 'turnover'
  ).length;
  
  const totalPatients = beds.filter(bed => bed.ratio && parseRatio(bed.ratio) !== null).length;
  const remainingAfterWard = currentPatients;
  const expectedFinalPatients = remainingAfterWard + comingInPatients + turnoverBeds;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Nursing Calculator</h1>
                <p className="text-sm text-gray-500">Intelligent Shift Planning System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">PRO</span>
              <span className="text-sm text-gray-500">© 2025 Calvary Care - Critical Care Unit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* AM Shift Display */}
        <div className="bg-white shadow-md rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              Morning Shift
            </h2>
            <span className="text-sm text-gray-500">0700 - 1500</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-200">
              <label className="text-sm text-gray-600 font-medium block mb-2">Nurses Required</label>
              <div className="text-4xl font-bold text-gray-900">{expectedNursesAM}</div>
              <p className="text-sm text-gray-500 mt-1">8-hour shift</p>
            </div>
            {expectedNursesAM > 0 && (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <label className="text-sm text-gray-600 font-medium block mb-2">Total Hours</label>
                <div className="text-4xl font-bold text-gray-900">{expectedNursesAM * 8}</div>
                <p className="text-sm text-gray-500 mt-1">Staff hours</p>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-white shadow-md rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-medium text-gray-700">View Mode</span>
            <div className="bg-gray-100 rounded-full p-1 flex">
              <button
                onClick={() => setViewMode('combined')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'combined' 
                    ? 'bg-white text-blue-600 shadow-md' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'split' 
                    ? 'bg-white text-blue-600 shadow-md' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Current → Expected
              </button>
            </div>
          </div>
        </div>

        {/* Bed Input Section */}
        <div className="bg-white shadow-md rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            {viewMode === 'split' ? 'Bed Status & Changes' : 'PM & Night Planning'}
          </h2>
          
          
          {viewMode === 'split' && (
            <div className="mb-8 grid md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-xl">
                <h3 className="font-bold text-blue-700 mb-2 text-sm">Current Status</h3>
                <p className="text-4xl font-bold text-gray-900">{currentPatients}</p>
                <p className="text-gray-600 text-sm">patients now</p>
                {toWardPatients > 0 && (
                  <p className="text-orange-600 text-sm mt-2 font-medium">-{toWardPatients} to ward</p>
                )}
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6 rounded-xl">
                <h3 className="font-bold text-green-700 mb-2 text-sm">Expected Status</h3>
                <p className="text-4xl font-bold text-gray-900">{expectedFinalPatients}</p>
                <p className="text-gray-600 text-sm">final count</p>
                <p className="text-indigo-600 text-sm mt-2 font-medium">
                  {expectedNursesPM} nurses needed
                </p>
              </div>
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-2">
            {beds.map(bed => (
              <div key={bed.id} className="bg-gray-50 border border-gray-200 p-5 rounded-xl hover:shadow-md transition-all">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-white border border-gray-300 px-3 py-1.5 rounded-lg font-bold text-gray-700 text-sm shadow-sm">
                      Bed {bed.id}
                    </span>
                    <input
                      type="text"
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
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
                        className={`bg-white border rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                          bed.status === 'discharge' ? 'border-red-300 text-red-600 bg-red-50' :
                          bed.status === 'turnover' ? 'border-purple-300 text-purple-600 bg-purple-50' :
                          bed.status === 'toWard' ? 'border-orange-300 text-orange-600 bg-orange-50' :
                          bed.status === 'comingIn' ? 'border-green-300 text-green-600 bg-green-50' :
                          bed.status === 'changeRatio' ? 'border-blue-300 text-blue-600 bg-blue-50' :
                          bed.status === 'bedMove' ? 'border-indigo-300 text-indigo-600 bg-indigo-50' :
                          bed.status === 'bedMoveWithRatio' ? 'border-pink-300 text-pink-600 bg-pink-50' :
                          'border-gray-300 text-gray-600'
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
                        className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                        style={{ 
                          backgroundImage: `linear-gradient(135deg, hsl(${bed.nurseAssigned * 60}, 70%, 55%), hsl(${bed.nurseAssigned * 60 + 30}, 70%, 45%))`
                        }}
                      >
                        N{bed.nurseAssigned}
                      </span>
                    )}
                    {bed.status === 'toWard' && bed.newAdmissionAfterWard && bed.pmNightNurseAssigned && (
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                        style={{ 
                          backgroundImage: `linear-gradient(135deg, hsl(${bed.pmNightNurseAssigned * 60}, 70%, 55%), hsl(${bed.pmNightNurseAssigned * 60 + 30}, 70%, 45%))`
                        }}
                      >
                        N{bed.pmNightNurseAssigned} (PM/Night)
                      </span>
                    )}
                  </div>
                  {bed.status === 'turnover' && (
                    <div className="flex items-center gap-2 ml-12">
                      <span className="text-xs text-purple-600 font-medium">New:</span>
                      <input
                        type="text"
                        className="flex-1 bg-white border border-purple-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
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
                      <span className="text-xs text-blue-600 font-medium">New:</span>
                      <input
                        type="text"
                        className="flex-1 bg-white border border-blue-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                        <span className="text-xs text-indigo-600 font-medium">To:</span>
                        <select
                          value={bed.moveToBed}
                          onChange={(e) => updateMoveToBed(bed.id, e.target.value)}
                          className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs text-gray-900"
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
                        <span className="text-xs text-indigo-600 font-medium">New:</span>
                        <input
                          type="text"
                          className="flex-1 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                        <span className="text-xs text-pink-600 font-medium">To:</span>
                        <select
                          value={bed.moveToBed}
                          onChange={(e) => updateMoveToBed(bed.id, e.target.value)}
                          className="bg-white border border-pink-300 rounded-lg px-2 py-1 text-xs text-gray-900"
                        >
                          <option value="">Select...</option>
                          {Array.from({ length: 11 }, (_, i) => i + 1)
                            .filter(num => num !== bed.id && !beds.find(b => b.id !== bed.id && b.moveToBed === String(num)))
                            .map(num => (
                              <option key={num} value={num}>Bed {num}</option>
                            ))}
                        </select>
                        <span className="text-xs text-pink-600 font-medium">@</span>
                        <input
                          type="text"
                          className="w-16 bg-white border border-pink-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
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
                        <span className="text-xs text-pink-600 font-medium">New:</span>
                        <input
                          type="text"
                          className="flex-1 bg-white border border-pink-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
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
                  {bed.status === 'toWard' && (
                    <div className="flex items-center gap-2 ml-12">
                      <span className="text-xs text-orange-600 font-medium">New Admission:</span>
                      <input
                        type="text"
                        className="flex-1 bg-white border border-orange-300 rounded-lg px-2 py-1 text-xs text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        value={bed.newAdmissionAfterWard}
                        onChange={(e) => {
                          if (validateRatio(e.target.value)) {
                            updateNewAdmissionAfterWard(bed.id, e.target.value);
                          }
                        }}
                        placeholder="PM/Night patient (e.g., 1:2)"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Bed Occupancy Visual */}
          <div className="mt-6 bg-gray-50 border border-gray-200 p-4 rounded-xl">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider mr-3">Bed Overview</span>
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
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold transition-all shadow-sm border-2 ${
                      !isOccupied ? 'bg-white border-gray-300 text-gray-400' :
                      isDischarged ? 'bg-red-100 border-red-300 text-red-700' :
                      isToWard ? 'bg-orange-100 border-orange-300 text-orange-700' :
                      isTurnover ? 'bg-purple-100 border-purple-300 text-purple-700' :
                      isAdmission ? 'bg-green-100 border-green-300 text-green-700' :
                      isChangeRatio ? 'bg-blue-100 border-blue-300 text-blue-700' :
                      isBedMove ? 'bg-indigo-100 border-indigo-300 text-indigo-700' :
                      isBedMoveWithRatio ? 'bg-pink-100 border-pink-300 text-pink-700' :
                      'bg-blue-50 border-blue-300 text-blue-700'
                    }`}
                    title={
                      !isOccupied ? `Bed ${bed.id}: Empty` :
                      `Bed ${bed.id}: ${bed.ratio}${
                        isDischarged ? ' (Discharge)' :
                        isToWard ? ` (To Ward${bed.newAdmissionAfterWard ? ` → ${bed.newAdmissionAfterWard}` : ''})` :
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
        <div className="bg-white shadow-md rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-600 rounded-xl flex items-center justify-center mr-3 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            Additional Staff
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={includeInCharge}
                onChange={(e) => setIncludeInCharge(e.target.checked)}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-800">In-Charge Nurse</span>
              <span className="text-sm text-gray-500 ml-auto">+1 nurse PM/Night</span>
            </label>
            
            <label className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={includeWardClerk}
                onChange={(e) => setIncludeWardClerk(e.target.checked)}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-800">Ward Clerk</span>
              <span className="text-sm text-gray-500 ml-auto">+7.5 hours</span>
            </label>
            
            <label className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={includeAM515}
                onChange={(e) => setIncludeAM515(e.target.checked)}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-800">AM 515</span>
              <span className="text-sm text-gray-500 ml-auto">+8 hours</span>
            </label>
            
            <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="flex items-center gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCNE}
                  onChange={(e) => setIncludeCNE(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-800">CNE</span>
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
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ml-auto"
                  />
                  {cneHours && calculateHoursFromRange(cneHours) > 0 && (
                    <span className="text-sm text-gray-500">
                      +{calculateHoursFromRange(cneHours).toFixed(1)}h
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {(expectedNursesAM > 0 || expectedNursesPM > 0 || totalPatients > 0) && (
          <div className="bg-white shadow-md rounded-2xl p-8 mb-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              24-Hour Summary
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6 rounded-xl">
                <h3 className="font-bold text-amber-700 mb-3 text-sm flex items-center">
                  <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  AM Shift
                </h3>
                <div className="text-4xl font-bold text-gray-900">{expectedNursesAM}</div>
                <div className="text-sm text-gray-600 mt-1">× 8h = {expectedNursesAM * 8}h</div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-xl">
                <h3 className="font-bold text-blue-700 mb-3 text-sm flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                  </svg>
                  PM Shift
                </h3>
                <div className="text-4xl font-bold text-gray-900">{expectedNursesPM}</div>
                <div className="text-sm text-gray-600 mt-1">× 8h = {expectedNursesPM * 8}h</div>
                {includeInCharge && <div className="text-xs text-gray-500 mt-1">(includes in-charge)</div>}
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 p-6 rounded-xl">
                <h3 className="font-bold text-purple-700 mb-3 text-sm flex items-center">
                  <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Night Shift
                </h3>
                <div className="text-4xl font-bold text-gray-900">{expectedNursesNight}</div>
                <div className="text-sm text-gray-600 mt-1">× 10h = {expectedNursesNight * 10}h</div>
                {includeInCharge && <div className="text-xs text-gray-500 mt-1">(includes in-charge)</div>}
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 p-6 rounded-xl">
              <h3 className="font-bold mb-4 text-gray-800 text-lg">Total Requirement</h3>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-600">24-hour total:</span>
                <span className="text-5xl font-bold text-gray-900">
                  {totalHours.toFixed(1)}h
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Admission Capacity */}
        {(pmAdmissionCapacity.length > 0 || nightAdmissionCapacity.length > 0) && (
          <div className="bg-white shadow-md rounded-2xl p-8 mb-6">
            <h2 className="text-2xl font-bold mb-8 text-gray-800 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center mr-3 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              Admission Capacity
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-lg">PM Shift</h3>
                </div>
                <div className="space-y-3">
                  {pmAdmissionCapacity.map((capacity, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200">
                        <span className="text-gray-700 font-medium">{capacity}</span>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                      {index < pmAdmissionCapacity.length - 1 && (
                        <div className="flex items-center justify-center py-2">
                          <div className="bg-blue-100 px-3 py-1 rounded-full">
                            <span className="text-blue-600 text-xs font-bold tracking-wider">OR</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
                
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-6">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-violet-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-lg">Night Shift</h3>
                </div>
                <div className="space-y-3">
                  {nightAdmissionCapacity.map((capacity, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-purple-200">
                        <span className="text-gray-700 font-medium">{capacity}</span>
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      </div>
                      {index < nightAdmissionCapacity.length - 1 && (
                        <div className="flex items-center justify-center py-2">
                          <div className="bg-purple-100 px-3 py-1 rounded-full">
                            <span className="text-purple-600 text-xs font-bold tracking-wider">OR</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nurse Assignments */}
        {nurseAssignments.length > 0 && (
          <div className="bg-white shadow-md rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              Nurse Assignments
            </h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nurseAssignments.map(nurse => {
                const workload = nurse.beds.reduce((sum, bed) => sum + (1 / bed.patientCount), 0);
                return (
                  <div 
                    key={nurse.id} 
                    className="bg-gray-50 border border-gray-200 p-5 rounded-xl hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-gray-800">Nurse {nurse.id}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        workload >= 0.9 ? 'bg-red-100 text-red-600 border border-red-300' : 
                        workload >= 0.7 ? 'bg-yellow-100 text-yellow-600 border border-yellow-300' : 
                        'bg-green-100 text-green-600 border border-green-300'
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
                          <p key={bed.id} className="text-gray-600 text-sm flex items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            Bed {bed.id} 
                            <span className="text-gray-500 ml-2">
                              (1:{displayRatio})
                              {actualBed?.status === 'turnover' && ' [new patient]'}
                              {actualBed?.status === 'comingIn' && ' [admission]'}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {includeInCharge && (
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 p-5 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-purple-700">In-Charge Nurse</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-600 border border-purple-300">
                      Leadership
                    </span>
                  </div>
                  <div className="space-y-2 text-purple-600 text-sm">
                    <p className="flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      Unit Supervision
                    </p>
                    <p className="flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      Staff Coordination
                    </p>
                    <p className="flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      Emergency Response
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