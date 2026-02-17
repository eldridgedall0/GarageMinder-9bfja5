import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Trip, Vehicle } from '../types/trip';

export interface ExportOptions {
  format: 'csv' | 'json';
  includeGpsData?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  vehicleIds?: string[];
}

// Export trips to CSV
export async function exportToCSV(trips: Trip[], vehicles: Vehicle[]): Promise<string> {
  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));
  
  const headers = [
    'Date',
    'Vehicle',
    'Start Time',
    'End Time',
    'Duration (min)',
    'Distance (mi)',
    'Start Odometer',
    'End Odometer',
    'Status',
    'Notes',
  ];

  const rows = trips.map(trip => {
    const vehicle = vehicleMap.get(trip.vehicleId);
    const vehicleName = vehicle 
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` 
      : 'Unknown';
    
    const duration = trip.endTime 
      ? Math.floor((trip.endTime.getTime() - trip.startTime.getTime()) / 60000)
      : 0;

    return [
      trip.startTime.toLocaleDateString(),
      vehicleName,
      trip.startTime.toLocaleTimeString(),
      trip.endTime?.toLocaleTimeString() || '',
      duration.toString(),
      (trip.adjustedDistance || trip.calculatedDistance).toFixed(2),
      trip.startOdometer.toString(),
      trip.endOdometer?.toString() || '',
      trip.status,
      `"${trip.notes.replace(/"/g, '""')}"`, // Escape quotes
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

// Export trips to JSON
export async function exportToJSON(trips: Trip[], vehicles: Vehicle[]): Promise<string> {
  const exportData = {
    exportDate: new Date().toISOString(),
    tripCount: trips.length,
    vehicles: vehicles.map(v => ({
      id: v.id,
      year: v.year,
      make: v.make,
      model: v.model,
      currentOdometer: v.currentOdometer,
    })),
    trips: trips.map(trip => ({
      id: trip.id,
      vehicleId: trip.vehicleId,
      startTime: trip.startTime.toISOString(),
      endTime: trip.endTime?.toISOString(),
      distance: trip.adjustedDistance || trip.calculatedDistance,
      calculatedDistance: trip.calculatedDistance,
      adjustedDistance: trip.adjustedDistance,
      startOdometer: trip.startOdometer,
      endOdometer: trip.endOdometer,
      duration: trip.duration,
      status: trip.status,
      notes: trip.notes,
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt?.toISOString(),
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

// Share exported file
export async function shareExportedFile(
  data: string,
  format: 'csv' | 'json'
): Promise<boolean> {
  try {
    const filename = `garageminder_trips_${Date.now()}.${format}`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, data, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: format === 'csv' ? 'text/csv' : 'application/json',
        dialogTitle: 'Export Trip Data',
        UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.json',
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error sharing export:', error);
    return false;
  }
}

// Generate mileage report
export function generateMileageReport(trips: Trip[], vehicles: Vehicle[]): string {
  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));
  
  // Group by vehicle
  const byVehicle = trips.reduce((acc, trip) => {
    const vehicleId = trip.vehicleId;
    if (!acc[vehicleId]) {
      acc[vehicleId] = [];
    }
    acc[vehicleId].push(trip);
    return acc;
  }, {} as Record<string, Trip[]>);

  let report = 'GARAGEMINDER MILEAGE REPORT\n';
  report += '='.repeat(50) + '\n\n';
  report += `Report Date: ${new Date().toLocaleDateString()}\n`;
  report += `Total Trips: ${trips.length}\n\n`;

  Object.entries(byVehicle).forEach(([vehicleId, vehicleTrips]) => {
    const vehicle = vehicleMap.get(vehicleId);
    const vehicleName = vehicle 
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` 
      : `Vehicle ${vehicleId}`;

    const totalMiles = vehicleTrips.reduce(
      (sum, trip) => sum + (trip.adjustedDistance || trip.calculatedDistance),
      0
    );

    report += `-`.repeat(50) + '\n';
    report += `${vehicleName}\n`;
    report += `-`.repeat(50) + '\n';
    report += `Trips: ${vehicleTrips.length}\n`;
    report += `Total Miles: ${totalMiles.toFixed(1)}\n`;
    report += `Average Trip: ${(totalMiles / vehicleTrips.length).toFixed(1)} mi\n\n`;
  });

  return report;
}
