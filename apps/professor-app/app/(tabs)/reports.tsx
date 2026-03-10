import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
  Modal, Animated, Easing, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import { ProfessorAPI } from '../../src/services/api';
import { COLORS, SPACING, RADIUS } from '../../src/constants';

// SheetJS – run: npx expo install xlsx
// Falls back to SpreadsheetML XML if not installed (no Excel warning)
let XLSX: any = null;
try { XLSX = require('xlsx'); } catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Course { course_id: string; name: string; code: string; }
interface StudentReport {
  name: string; roll_number: string;
  total_sessions: number; present_count: number;
  absent_count: number; attendance_percentage: number;
}
type ExportFormat = 'pdf' | 'csv' | 'json' | 'doc' | 'xlsx';

interface FormatOption {
  key: ExportFormat; label: string; ext: string;
  mime: string; icon: string; color: string; description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { key: 'pdf',  label: 'PDF',   ext: 'pdf',  mime: 'application/pdf',         icon: '📄', color: '#E53935', description: 'Printable document'  },
  { key: 'xlsx', label: 'Excel', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', icon: '📊', color: '#2E7D32', description: 'Excel workbook'   },
  { key: 'csv',  label: 'CSV',   ext: 'csv',  mime: 'text/csv',                icon: '📋', color: '#43A047', description: 'Spreadsheet data'  },
  { key: 'json', label: 'JSON',  ext: 'json', mime: 'application/json',        icon: '{ }',color: '#1E88E5', description: 'Raw structured data' },
  { key: 'doc',  label: 'Word',  ext: 'rtf',  mime: 'application/rtf',         icon: '📝', color: '#1565C0', description: 'Word / Pages doc'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Content generators
// ─────────────────────────────────────────────────────────────────────────────

function generateCSV(course: Course, data: StudentReport[]): string {
  const header = ['Name', 'Roll Number', 'Total Sessions', 'Present', 'Absent', 'Attendance %'].join(',');
  const rows = data.map(s =>
    [`"${s.name}"`, s.roll_number, s.total_sessions, s.present_count,
     s.absent_count, `${Number(s.attendance_percentage).toFixed(1)}%`].join(',')
  );
  return [
    `"Attendance Report: ${course.name} (${course.code})"`,
    `"Generated: ${new Date().toLocaleString()}"`,
    '', header, ...rows,
  ].join('\n');
}

function generateJSON(course: Course, data: StudentReport[]): string {
  return JSON.stringify({
    course_name: course.name, course_code: course.code,
    generated_at: new Date().toISOString(), total_students: data.length,
    students: data.map(s => ({
      name: s.name, roll_number: s.roll_number,
      total_sessions: s.total_sessions, present_count: s.present_count,
      absent_count: s.absent_count,
      attendance_percentage: `${Number(s.attendance_percentage).toFixed(1)}%`,
    })),
  }, null, 2);
}

function generateRTF(course: Course, data: StudentReport[]): string {
  const avg = data.length
    ? (data.reduce((a, s) => a + Number(s.attendance_percentage), 0) / data.length).toFixed(1) : '0';

  const tableRows = data.map((s, i) => {
    const pct = Number(s.attendance_percentage).toFixed(1);
    const isLow = Number(s.attendance_percentage) < 75;
    return (
      `\\trowd\\trgaph100\\trleft-100` +
      `\\cellx600\\cellx3000\\cellx4500\\cellx5500\\cellx6500\\cellx7500\\cellx8500` +
      `\\pard\\intbl\\qc ${i + 1}\\cell` +
      `\\pard\\intbl ${s.name}\\cell` +
      `\\pard\\intbl\\qc\\f1 ${s.roll_number}\\cell` +
      `\\pard\\intbl\\qc ${s.total_sessions}\\cell` +
      `\\pard\\intbl\\qc\\cf3 ${s.present_count}\\cf0\\cell` +
      `\\pard\\intbl\\qc\\cf2 ${s.absent_count}\\cf0\\cell` +
      `\\pard\\intbl\\qc\\b ${isLow ? '\\cf2 ' : '\\cf3 '}${pct}%\\b0\\cf0\\cell\\row`
    );
  }).join('\n');

  const hdr =
    `\\trowd\\trgaph100\\trleft-100` +
    `\\cellx600\\cellx3000\\cellx4500\\cellx5500\\cellx6500\\cellx7500\\cellx8500` +
    `\\pard\\intbl\\b\\cf1\\qc #\\cell Name\\cell\\qc Roll No.\\cell Total\\cell Present\\cell Absent\\cell Attend.%\\b0\\cf0\\cell\\row`;

  return (
    `{\\rtf1\\ansi\\deff0` +
    `{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\fmodern\\fcharset0 Courier New;}}` +
    `{\\colortbl;\\red255\\green255\\blue255;\\red198\\green40\\blue40;\\red46\\green125\\blue50;\\red21\\green101\\blue192;}` +
    `\\paperw12240\\paperh15840\\margl1440\\margr1440\\margt1440\\margb1440\\f0\\fs20` +
    `\\pard\\qc\\b\\fs32\\cf4 Attendance Report\\b0\\fs20\\cf0\\par` +
    `\\pard\\qc\\b\\fs24 ${course.name} (${course.code})\\b0\\fs20\\par` +
    `\\pard\\qc Generated: ${new Date().toLocaleString()}\\par\\par` +
    `\\pard Students: \\b ${data.length}\\b0   |   Avg: \\b ${avg}%\\b0   |   Below 75%: \\b\\cf2 ${data.filter(s => Number(s.attendance_percentage) < 75).length}\\cf0\\b0\\par\\par` +
    hdr + '\n' + tableRows +
    `\\par\\pard\\fs16\\cf2 * Red values indicate attendance below 75%.\\cf0\\fs20\\par` +
    `}`
  );
}

/** Valid SpreadsheetML XML – opens in Excel without any format-mismatch warning */
function generateSpreadsheetML(course: Course, data: StudentReport[]): string {
  const avg = data.length
    ? (data.reduce((a, s) => a + Number(s.attendance_percentage), 0) / data.length).toFixed(1) : '0';
  const esc = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const dataRows = data.map((s, i) => {
    const pct = Number(s.attendance_percentage).toFixed(1);
    const status = Number(s.attendance_percentage) >= 75 ? 'Regular'
      : Number(s.attendance_percentage) >= 60 ? 'Low' : 'Critical';
    return (
      `<Row>` +
      `<Cell><Data ss:Type="Number">${i + 1}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(s.name)}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(s.roll_number)}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${s.total_sessions}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${s.present_count}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${s.absent_count}</Data></Cell>` +
      `<Cell><Data ss:Type="Number">${pct}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${status}</Data></Cell>` +
      `</Row>`
    );
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Attendance – ${esc(course.code)}</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="15" ss:Color="#1565C0"/></Style>
  <Style ss:ID="meta"><Font ss:Italic="1" ss:Color="#757575" ss:Size="10"/></Style>
  <Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1565C0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="pct"><NumberFormat ss:Format="0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Attendance Report">
  <Table>
   <Column ss:Width="36"/><Column ss:Width="200"/><Column ss:Width="130"/>
   <Column ss:Width="110"/><Column ss:Width="80"/><Column ss:Width="80"/>
   <Column ss:Width="95"/><Column ss:Width="90"/>
   <Row><Cell ss:StyleID="title" ss:MergeAcross="7"><Data ss:Type="String">Attendance Report: ${esc(course.name)} (${esc(course.code)})</Data></Cell></Row>
   <Row><Cell ss:StyleID="meta" ss:MergeAcross="7"><Data ss:Type="String">Generated: ${new Date().toLocaleString()} | Students: ${data.length} | Avg: ${avg}%</Data></Cell></Row>
   <Row/>
   <Row>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Name</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Roll Number</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Total Sessions</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Present</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Absent</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Attendance %</Data></Cell>
    <Cell ss:StyleID="hdr"><Data ss:Type="String">Status</Data></Cell>
   </Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

async function generateXLSX(course: Course, data: StudentReport[]): Promise<{ content: string; isBase64: boolean }> {
  if (XLSX) {
    try {
      const wsData = [
        [`Attendance Report: ${course.name} (${course.code})`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ['#', 'Name', 'Roll Number', 'Total Sessions', 'Present', 'Absent', 'Attendance %', 'Status'],
        ...data.map((s, i) => [
          i + 1, s.name, s.roll_number, s.total_sessions, s.present_count, s.absent_count,
          parseFloat(Number(s.attendance_percentage).toFixed(1)),
          Number(s.attendance_percentage) >= 75 ? 'Regular' : Number(s.attendance_percentage) >= 60 ? 'Low' : 'Critical',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }];
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      return { content: b64, isBase64: true };
    } catch (e) {
      console.warn('SheetJS write failed, using SpreadsheetML fallback', e);
    }
  }
  return { content: generateSpreadsheetML(course, data), isBase64: false };
}

function buildPrintHTML(course: Course, data: StudentReport[]): string {
  const totalPresent  = data.reduce((a, s) => a + s.present_count, 0);
  const totalSessions = data.reduce((a, s) => a + s.total_sessions, 0);
  const avg     = data.length ? (data.reduce((a, s) => a + Number(s.attendance_percentage), 0) / data.length).toFixed(1) : '0';
  const below75 = data.filter(s => Number(s.attendance_percentage) < 75).length;

  const rows = data.map((s, i) => {
    const pct   = Number(s.attendance_percentage).toFixed(1);
    const num   = Number(s.attendance_percentage);
    const color = num >= 75 ? '#2e7d32' : num >= 60 ? '#e65100' : '#c62828';
    const bg    = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
    return `<tr style="background:${bg}">
      <td style="text-align:center;color:#999;font-size:11px">${i + 1}</td>
      <td style="font-weight:600">${s.name}</td>
      <td style="text-align:center;font-family:monospace;font-size:11px">${s.roll_number}</td>
      <td style="text-align:center">${s.total_sessions}</td>
      <td style="text-align:center;color:#2e7d32;font-weight:700">${s.present_count}</td>
      <td style="text-align:center;color:#c62828;font-weight:700">${s.absent_count}</td>
      <td style="text-align:center;font-weight:800;color:${color};font-size:14px">${pct}%</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Attendance – ${course.code}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#212121;background:#fff;padding:28px;font-size:13px}
  h1{font-size:20px;color:#1565c0;font-weight:800}
  h2{font-size:13px;color:#666;font-weight:400;margin-top:3px}
  .meta{font-size:10px;color:#aaa;margin-top:8px;padding-top:8px;border-top:1px solid #eee}
  .stats{display:flex;gap:12px;margin:18px 0}
  .stat{flex:1;background:#f5f7ff;border-radius:8px;padding:10px 12px;border-left:4px solid #1565c0}
  .stat.g{border-color:#2e7d32}.stat.r{border-color:#c62828}
  .stat .v{font-size:20px;font-weight:800;color:#1565c0}
  .stat.g .v{color:#2e7d32}.stat.r .v{color:#c62828}
  .stat .l{font-size:9px;color:#888;margin-top:1px;text-transform:uppercase;letter-spacing:.4px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead tr{background:#1565c0}
  th{color:#fff;padding:9px 10px;text-align:left;font-size:10.5px;letter-spacing:.3px}
  td{padding:8px 10px;border-bottom:1px solid #eee}
  .foot{margin-top:18px;font-size:9.5px;color:#ccc;text-align:center;border-top:1px solid #eee;padding-top:10px}
</style>
</head>
<body>
<h1>${course.name}</h1>
<h2>Course: ${course.code} · Attendance Report</h2>
<p class="meta">Generated: ${new Date().toLocaleString()} · ${data.length} students enrolled</p>
<div class="stats">
  <div class="stat"><div class="v">${data.length}</div><div class="l">Students</div></div>
  <div class="stat g"><div class="v">${avg}%</div><div class="l">Avg Attendance</div></div>
  <div class="stat"><div class="v">${totalPresent}/${totalSessions}</div><div class="l">Sessions</div></div>
  <div class="stat r"><div class="v">${below75}</div><div class="l">Below 75%</div></div>
</div>
<table>
<thead><tr><th>#</th><th>Name</th><th>Roll Number</th><th>Total</th><th>Present</th><th>Absent</th><th>Attend.%</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="foot">${course.name} (${course.code}) · Below 75% attendance = risk of debarment · ${new Date().toLocaleDateString()}</div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Save to device storage
// ─────────────────────────────────────────────────────────────────────────────
async function saveToDevice(sourceUri: string, filename: string): Promise<void> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission required', 'Please allow storage access to save files to your device.');
    return;
  }

  // Copy to documentDirectory (persisted, accessible via Files app on both platforms)
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  if (Platform.OS === 'ios') {
    // On iOS, share to Files app so user can pick a save location
    await Sharing.shareAsync(destUri, { dialogTitle: 'Save to Files', UTI: 'public.data' });
  } else {
    // On Android, documentDirectory is in app storage; inform user of path
    Alert.alert(
      '✓ File Saved',
      `Saved as:\n${filename}\n\nFind it in your Files app under "Internal Storage → Android → data → [app] → files".`,
      [{ text: 'OK' }]
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExportModal
// ─────────────────────────────────────────────────────────────────────────────
interface ExportModalProps {
  visible: boolean; course: Course; data: StudentReport[]; onClose: () => void;
}

function ExportModal({ visible, course, data, onClose }: ExportModalProps) {
  const slideAnim = useRef(new Animated.Value(420)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [busy, setBusy]     = useState<string | null>(null); // `${fmt.key}_share` | `${fmt.key}_download`

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 170, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 420, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  async function handleExport(fmt: FormatOption, action: 'share' | 'download') {
    if (busy) return;
    const busyKey = `${fmt.key}_${action}`;
    setBusy(busyKey);

    try {
      const ts       = Date.now();
      const safeName = `${course.code}_attendance_${ts}`;
      let fileUri    = '';

      // ── Build the file ──────────────────────────────────────────────────
      if (fmt.key === 'pdf') {
        const html     = buildPrintHTML(course, data);
        const { uri }  = await Print.printToFileAsync({ html });
        const dest     = `${FileSystem.cacheDirectory}${safeName}.pdf`;
        await FileSystem.moveAsync({ from: uri, to: dest });
        fileUri = dest;

      } else if (fmt.key === 'xlsx') {
        const { content, isBase64 } = await generateXLSX(course, data);
        fileUri = `${FileSystem.cacheDirectory}${safeName}.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: isBase64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
        });

      } else {
        const ext     = fmt.key === 'doc' ? 'rtf' : fmt.ext;
        const content = fmt.key === 'csv' ? generateCSV(course, data)
          : fmt.key === 'json' ? generateJSON(course, data)
          : generateRTF(course, data);
        fileUri = `${FileSystem.cacheDirectory}${safeName}.${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      }

      // ── Deliver ─────────────────────────────────────────────────────────
      if (action === 'share') {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('Sharing not available', 'Use Download instead.');
          return;
        }
        await Sharing.shareAsync(fileUri, { mimeType: fmt.mime, dialogTitle: `Share ${fmt.label} Report` });
      } else {
        const ext      = fmt.key === 'doc' ? 'rtf' : fmt.ext;
        const filename = `${safeName}.${ext}`;
        await saveToDevice(fileUri, filename);
      }

    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Export Report</Text>
              <Text style={styles.modalSub}>{course.name} · {data.length} students</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#555' }]} />
              <Text style={styles.legendTxt}><Text style={{ fontWeight: '700' }}>Share</Text> — open with another app, email, messages</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1565C0' }]} />
              <Text style={styles.legendTxt}><Text style={{ fontWeight: '700' }}>Download</Text> — save directly to device storage</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Format rows */}
          <View style={styles.fmtList}>
            {FORMAT_OPTIONS.map(fmt => {
              const shareKey = `${fmt.key}_share`;
              const dlKey    = `${fmt.key}_download`;
              const isShareBusy = busy === shareKey;
              const isDlBusy    = busy === dlKey;
              const disabled    = !!busy;

              return (
                <View key={fmt.key} style={[styles.fmtRow, { borderLeftColor: fmt.color }]}>
                  {/* Icon */}
                  <View style={[styles.fmtIconWrap, { backgroundColor: fmt.color + '15' }]}>
                    <Text style={styles.fmtIconTxt}>{fmt.icon}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.fmtInfo}>
                    <Text style={[styles.fmtLabel, { color: fmt.color }]}>{fmt.label}</Text>
                    <Text style={styles.fmtDesc}>{fmt.description}</Text>
                  </View>

                  {/* Buttons */}
                  <View style={styles.btnGroup}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnShare, disabled && styles.btnDisabled]}
                      onPress={() => handleExport(fmt, 'share')}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      {isShareBusy
                        ? <ActivityIndicator size="small" color="#555" />
                        : <Text style={styles.btnShareTxt}>↑ Share</Text>
                      }
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btn, styles.btnDownload, { backgroundColor: fmt.color }, disabled && styles.btnDisabled]}
                      onPress={() => handleExport(fmt, 'download')}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      {isDlBusy
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.btnDownloadTxt}>↓ Save</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.modalNote}>
            PDF uses your device's print engine — no HTML file. Excel opens without format warnings.
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen (unchanged logic)
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [courses, setCourses]               = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [report, setReport]                 = useState<StudentReport[]>([]);
  const [loading, setLoading]               = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [exportVisible, setExportVisible]   = useState(false);

  useEffect(() => {
    ProfessorAPI.getCourses()
      .then((res) => setCourses(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoadingCourses(false));
  }, []);

  async function loadReport(course: Course) {
    setSelectedCourse(course);
    setLoading(true);
    try {
      const res = await ProfessorAPI.getCourseReport(course.course_id);
      setReport(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getPctColor(pct: number) {
    if (pct >= 75) return COLORS.success;
    if (pct >= 60) return COLORS.warning;
    return COLORS.danger;
  }

  if (loadingCourses) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Attendance Reports</Text>
          {selectedCourse && report.length > 0 && (
            <TouchableOpacity style={styles.exportHeaderBtn} onPress={() => setExportVisible(true)} activeOpacity={0.8}>
              <Text style={styles.exportHeaderIcon}>⬇</Text>
              <Text style={styles.exportHeaderTxt}>Export</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Course selector */}
      <View style={styles.courseBar}>
        <FlatList
          horizontal data={courses}
          keyExtractor={(c) => c.course_id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.coursePills}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.coursePill, selectedCourse?.course_id === item.course_id && styles.coursePillActive]}
              onPress={() => loadReport(item)}
            >
              <Text style={[styles.coursePillText, selectedCourse?.course_id === item.course_id && styles.coursePillTextActive]}>
                {item.code}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Report list */}
      {!selectedCourse ? (
        <View style={styles.center}><Text style={styles.selectHint}>Select a course to view report</Text></View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={report}
          keyExtractor={(item) => item.roll_number}
          contentContainerStyle={styles.reportList}
          ListHeaderComponent={
            <View style={styles.reportHeaderRow}>
              <Text style={styles.reportTitle}>{selectedCourse.name}</Text>
              <Text style={styles.reportCount}>{report.length} students</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No data yet for this course.</Text>}
          renderItem={({ item }) => {
            const pct   = Number(item.attendance_percentage) || 0;
            const color = getPctColor(pct);
            return (
              <View style={styles.reportCard}>
                <View style={styles.reportLeft}>
                  <Text style={styles.reportName}>{item.name}</Text>
                  <Text style={styles.reportRoll}>{item.roll_number}</Text>
                  <Text style={styles.reportSessions}>{item.present_count}/{item.total_sessions} sessions</Text>
                </View>
                <View style={[styles.pctCircle, { borderColor: color }]}>
                  <Text style={[styles.pctText, { color }]}>{pct}%</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {selectedCourse && (
        <ExportModal visible={exportVisible} course={selectedCourse} data={report} onClose={() => setExportVisible(false)} />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:          { backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.md },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: COLORS.white },
  exportHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  exportHeaderIcon:{ fontSize: 13, color: COLORS.white },
  exportHeaderTxt: { fontSize: 13, fontWeight: '700', color: COLORS.white },

  courseBar:            { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  coursePills:          { padding: SPACING.sm, gap: SPACING.xs },
  coursePill:           { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  coursePillActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  coursePillText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  coursePillTextActive: { color: COLORS.white },

  selectHint:      { fontSize: 14, color: COLORS.textMuted },
  reportList:      { padding: SPACING.md, gap: SPACING.sm },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  reportTitle:     { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  reportCount:     { fontSize: 12, color: COLORS.textMuted, marginLeft: SPACING.sm },
  reportCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  reportLeft:      { flex: 1 },
  reportName:      { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  reportRoll:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  reportSessions:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  pctCircle:       { width: 56, height: 56, borderRadius: 28, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  pctText:         { fontSize: 14, fontWeight: '800' },
  emptyText:       { color: COLORS.textMuted, textAlign: 'center', padding: SPACING.xl },

  // ── Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 34, paddingTop: 10, elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 16 },
  modalHandle:   { width: 38, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle:    { fontSize: 17, fontWeight: '800', color: '#212121' },
  modalSub:      { fontSize: 12, color: '#999', marginTop: 3 },
  modalCloseTxt: { fontSize: 18, color: '#ccc', fontWeight: '400', paddingHorizontal: 4 },

  legendRow:  { gap: 5, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt:  { fontSize: 11.5, color: '#888' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 14 },

  fmtList: { gap: 9 },
  fmtRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
  fmtIconWrap: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fmtIconTxt:  { fontSize: 20 },
  fmtInfo:     { flex: 1 },
  fmtLabel:    { fontSize: 13.5, fontWeight: '800' },
  fmtDesc:     { fontSize: 10.5, color: '#aaa', marginTop: 1 },

  btnGroup:       { flexDirection: 'row', gap: 6 },
  btn:            { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:    { opacity: 0.45 },
  btnShare:       { borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#fafafa' },
  btnShareTxt:    { fontSize: 11.5, fontWeight: '700', color: '#444' },
  btnDownload:    {},
  btnDownloadTxt: { fontSize: 11.5, fontWeight: '700', color: '#fff' },

  modalNote: { marginTop: 14, fontSize: 10.5, color: '#bbb', textAlign: 'center', lineHeight: 15 },
});