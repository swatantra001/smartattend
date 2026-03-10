// // D:\smartattend\apps\student-app\src\components\SessionChat.tsx
// // NEW FILE — WhatsApp-style chat for students during a session
// // Students can send a message; they see their own messages + professor replies

// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View, Text, TextInput, TouchableOpacity, FlatList,
//   StyleSheet, KeyboardAvoidingView, Platform
// } from 'react-native';
// import { io, Socket } from 'socket.io-client';
// import { useAuthStore } from '../store/auth.store';
// import { COLORS, SPACING, RADIUS } from '../constants';

// interface ChatMessage {
//   message_id: string;
//   sender_type: 'STUDENT' | 'PROFESSOR';
//   student_name?: string;
//   roll_number?: string;
//   professor_name?: string;
//   message: string;
//   created_at: string;
//   is_mine?: boolean;
// }

// interface Props {
//   sessionId: string;
//   socket: Socket;
// }

// export default function SessionChat({ sessionId, socket }: Props) {
//   const { user } = useAuthStore();
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [inputText, setInputText] = useState('');
//   const flatListRef = useRef<FlatList>(null);

//   useEffect(() => {
//     // Listen for professor's replies (broadcast to all)
//     const onProfMessage = (msg: ChatMessage) => {
//       setMessages(prev => [...prev, { ...msg, is_mine: false }]);
//       setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
//     };

//     // Listen for echo of our own sent message
//     const onMine = (msg: ChatMessage) => {
//       setMessages(prev => [...prev, { ...msg, is_mine: true }]);
//       setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
//     };

//     socket.on('professor_chat_message', onProfMessage);
//     socket.on('chat_message_sent', onMine);

//     return () => {
//       socket.off('professor_chat_message', onProfMessage);
//       socket.off('chat_message_sent', onMine);
//     };
//   }, [socket]);

//   function sendMessage() {
//     const text = inputText.trim();
//     if (!text) return;

//     socket.emit('chat_message', {
//       session_id: sessionId,
//       message: text
//     });
//     setInputText('');
//   }

//   function formatTime(iso: string) {
//     const d = new Date(iso);
//     return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
//   }

//   function renderMessage({ item }: { item: ChatMessage }) {
//     const isProfessor = item.sender_type === 'PROFESSOR';
//     const isMine = item.is_mine;

//     return (
//       <View style={[
//         styles.messageRow,
//         isMine ? styles.rowRight : styles.rowLeft,
//         isProfessor && styles.rowLeft
//       ]}>
//         <View style={[
//           styles.bubble,
//           isMine ? styles.bubbleMine : isProfessor ? styles.bubbleProfessor : styles.bubbleOther
//         ]}>
//           {isProfessor && (
//             <Text style={styles.senderName}>👨‍🏫 {item.professor_name}</Text>
//           )}
//           <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
//             {item.message}
//           </Text>
//           <Text style={[styles.timeText, isMine && styles.timeTextMine]}>
//             {formatTime(item.created_at)}
//           </Text>
//         </View>
//       </View>
//     );
//   }

//   return (
//     <KeyboardAvoidingView
//       behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//       style={styles.container}
//       keyboardVerticalOffset={80}
//     >
//       <View style={styles.header}>
//         <Text style={styles.headerText}>💬 Session Chat</Text>
//         <Text style={styles.headerSub}>Send a message to your professor</Text>
//       </View>

//       <FlatList
//         ref={flatListRef}
//         data={messages}
//         keyExtractor={(item, i) => item.message_id + i}
//         renderItem={renderMessage}
//         contentContainerStyle={styles.messageList}
//         ListEmptyComponent={
//           <View style={styles.empty}>
//             <Text style={styles.emptyText}>No messages yet. Send a message if you have any concerns.</Text>
//           </View>
//         }
//         onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
//       />

//       <View style={styles.inputRow}>
//         <TextInput
//           style={styles.input}
//           value={inputText}
//           onChangeText={setInputText}
//           placeholder="Type your message..."
//           placeholderTextColor={COLORS.textMuted}
//           multiline
//           maxLength={500}
//           returnKeyType="send"
//           onSubmitEditing={sendMessage}
//         />
//         <TouchableOpacity
//           style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
//           onPress={sendMessage}
//           disabled={!inputText.trim()}
//         >
//           <Text style={styles.sendBtnText}>Send</Text>
//         </TouchableOpacity>
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: COLORS.background },
//   header: {
//     backgroundColor: COLORS.primary,
//     padding: SPACING.md,
//   },
//   headerText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
//   headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
//   messageList: { padding: SPACING.md, gap: SPACING.sm },
//   messageRow: { flexDirection: 'row', marginBottom: SPACING.xs },
//   rowLeft: { justifyContent: 'flex-start' },
//   rowRight: { justifyContent: 'flex-end' },
//   bubble: {
//     maxWidth: '80%',
//     borderRadius: RADIUS.md,
//     padding: SPACING.sm,
//   },
//   bubbleMine: { backgroundColor: COLORS.primary },
//   bubbleProfessor: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' },
//   bubbleOther: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
//   senderName: { fontSize: 11, fontWeight: '700', color: '#2E7D32', marginBottom: 3 },
//   messageText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
//   messageTextMine: { color: COLORS.white },
//   timeText: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, textAlign: 'right' },
//   timeTextMine: { color: 'rgba(255,255,255,0.6)' },
//   empty: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: SPACING.xl },
//   emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
//   inputRow: {
//     flexDirection: 'row',
//     alignItems: 'flex-end',
//     padding: SPACING.sm,
//     borderTopWidth: 1,
//     borderTopColor: COLORS.border,
//     backgroundColor: COLORS.white,
//     gap: SPACING.xs
//   },
//   input: {
//     flex: 1,
//     backgroundColor: COLORS.background,
//     borderRadius: RADIUS.full,
//     paddingHorizontal: SPACING.md,
//     paddingVertical: SPACING.xs,
//     fontSize: 14,
//     maxHeight: 80,
//     color: COLORS.textPrimary,
//     borderWidth: 1,
//     borderColor: COLORS.border
//   },
//   sendBtn: {
//     backgroundColor: COLORS.primary,
//     borderRadius: RADIUS.full,
//     paddingHorizontal: SPACING.md,
//     paddingVertical: SPACING.sm,
//   },
//   sendBtnDisabled: { opacity: 0.5 },
//   sendBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' }
// });












// D:\smartattend\apps\student-app\src\components\SessionChat.tsx
// Floating 💬 button that appears only when a session is active.
// Tapping opens a slide-up chat modal so the student can message the professor.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
	View, Text, TextInput, TouchableOpacity, FlatList,
	StyleSheet, KeyboardAvoidingView, Platform, Modal,
	Animated, Easing,
} from 'react-native';
import { Socket } from 'socket.io-client';
import { COLORS, SPACING, RADIUS } from '../constants';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
	message_id: string;
	sender_type: 'STUDENT' | 'PROFESSOR';
	student_name?: string;
	roll_number?: string;
	professor_name?: string;
	message: string;
	created_at: string;
	is_mine?: boolean;
}

export interface SessionChatProps {
	sessionId: string;
	socket: Socket;
	courseName: string;
	professorName: string;
	forceOpen?: boolean;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function SessionChat({
	sessionId,
	socket,
	courseName,
	professorName,
	forceOpen = false,
}: SessionChatProps) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputText, setInputText] = useState('');
	const [unreadCount, setUnreadCount] = useState(0);
	const flatListRef = useRef<FlatList>(null);
	const [joined, setJoined] = useState(false);
	const [unread, setUnread] = useState(0);

	// FAB pulse animation — fires on every new incoming message while closed
	const pulseScale = useRef(new Animated.Value(1)).current;
	const pulsing = useRef(false);

	// After your isOpen state declaration:
	useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

	// ── Socket listeners ──────────────────────────────────────────────────────
	// useEffect(() => {
	// 	// Message from the professor (broadcast to all students in session room)
	// 	const onProfMessage = (msg: ChatMessage) => {
	// 		setMessages(prev => [...prev, { ...msg, is_mine: false }]);
	// 		if (!open) {
	// 			setUnreadCount(n => n + 1);
	// 			triggerFabPulse();
	// 		}
	// 		scrollToBottom();
	// 	};

	// 	// ADD this effect (alongside the existing socket listener effects):
	// 	useEffect(() => {
	// 		if (!socket) return;

	// 		// ── Confirm we're in the room ──────────────────────────────────────────────
	// 		const onJoined = () => setJoined(true);
	// 		socket.on('joined', onJoined);

	// 		// ── Echo of student's own message (server confirms + gives real message_id) ─
	// 		// This is the fix for "message not visible to sender".
	// 		// The server emits 'chat_message_sent' with the full payload including created_at.
	// 		const onMessageSent = (msg: any) => {
	// 			setMessages(prev => {
	// 				// Avoid duplicates if optimistic append was used
	// 				if (prev.some(m => m.message_id === msg.message_id)) return prev;
	// 				return [...prev, { ...msg, is_mine: true }];
	// 			});
	// 			setUnread(0); // it's our own message, never increment badge
	// 			setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
	// 		};
	// 		socket.on('chat_message_sent', onMessageSent);

	// 		return () => {
	// 			socket.off('joined', onJoined);
	// 			socket.off('chat_message_sent', onMessageSent);
	// 		};
	// 	}, [socket]);


	// 	// Server echo confirming our own sent message
	// 	const onEcho = (msg: ChatMessage) => {
	// 		setMessages(prev => [...prev, { ...msg, is_mine: true }]);
	// 		scrollToBottom();
	// 	};

	// 	socket.on('professor_chat_message', onProfMessage);
	// 	socket.on('chat_message_sent', onEcho);

	// 	return () => {
	// 		socket.off('professor_chat_message', onProfMessage);
	// 		socket.off('chat_message_sent', onEcho);
	// 	};
	// }, [socket, open]);


	// Effect 1: professor messages + open state
	useEffect(() => {
		const onProfMessage = (msg: ChatMessage) => {
			setMessages(prev => [...prev, { ...msg, is_mine: false }]);
			if (!open) {
				setUnreadCount(n => n + 1);
				triggerFabPulse();
			}
			scrollToBottom();
		};

		socket.on('professor_chat_message', onProfMessage);

		return () => {
			socket.off('professor_chat_message', onProfMessage);
		};
	}, [socket, open]);

	// Effect 2: joined confirmation + own message echo (separate, top-level)
	useEffect(() => {
		const onJoined = () => setJoined(true);
		socket.on('joined', onJoined);

		const onMessageSent = (msg: any) => {
			setMessages(prev => {
				if (prev.some(m => m.message_id === msg.message_id)) return prev;
				return [...prev, { ...msg, is_mine: true }];
			});
			setUnread(0);
			setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
		};
		socket.on('chat_message_sent', onMessageSent);

		return () => {
			socket.off('joined', onJoined);
			socket.off('chat_message_sent', onMessageSent);
		};
	}, [socket]);

	// Clear badge when modal opens
	const handleOpen = useCallback(() => {
		setOpen(true);
		setUnreadCount(0);
		setTimeout(scrollToBottom, 200);
	}, []);

	function scrollToBottom() {
		setTimeout(() => {
			flatListRef.current?.scrollToEnd({ animated: true });
		}, 80);
	}

	function triggerFabPulse() {
		if (pulsing.current) return;
		pulsing.current = true;
		Animated.sequence([
			Animated.timing(pulseScale, {
				toValue: 1.28, duration: 160,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
			Animated.spring(pulseScale, {
				toValue: 1, friction: 3, useNativeDriver: true,
			}),
		]).start(() => { pulsing.current = false; });
	}

	function handleSend() {
		const text = inputText.trim();
		if (!text || !joined) return;

		setInputText('');
		setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

		// Emit to server — 'chat_message_sent' echo will arrive and dedup via message_id check
		socket.emit('chat_message', { session_id: sessionId, message: text });
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString('en-IN', {
			hour: '2-digit', minute: '2-digit',
		});
	}

	// ── Render one bubble ─────────────────────────────────────────────────────
	function renderMessage({ item }: { item: ChatMessage }) {
		const isProfessor = item.sender_type === 'PROFESSOR';
		const isMine = !!item.is_mine;

		return (
			<View style={[styles.msgRow, isMine ? styles.rowRight : styles.rowLeft]}>
				<View style={[
					styles.bubble,
					isMine ? styles.bubbleMine
						: isProfessor ? styles.bubbleProf
							: styles.bubbleOther,
				]}>
					{isProfessor && (
						<Text style={styles.profLabel}>
							👨‍🏫 Prof. {item.professor_name ?? professorName}
						</Text>
					)}
					<Text style={[styles.msgText, isMine && styles.msgTextMine]}>
						{item.message}
					</Text>
					<Text style={[styles.timeText, isMine && styles.timeTextMine]}>
						{formatTime(item.created_at)}
					</Text>
				</View>
			</View>
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<>
			{/* ── FLOATING ACTION BUTTON ──────────────────────────────────────────
          Sits above the tab bar. Bounces when a new message arrives while
          the chat is closed. Shows a red unread count badge.
      ─────────────────────────────────────────────────────────────────── */}
			<Animated.View
				style={[
					styles.fab,
					// insets.bottom ≈ 34 on iPhone notch, 0 on Android.
					// Tab bar is 64px tall (see _layout) — lift the FAB above it.
					{ bottom: 10 },
					{ transform: [{ scale: pulseScale }] },
				]}
			>
				<TouchableOpacity
					style={styles.fabBtn}
					onPress={handleOpen}
					activeOpacity={0.82}
				>
					<Text style={styles.fabIcon}>💬</Text>

					{unreadCount > 0 && (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>
								{unreadCount > 9 ? '9+' : String(unreadCount)}
							</Text>
						</View>
					)}
				</TouchableOpacity>
			</Animated.View>

			{/* ── CHAT MODAL (slide up from bottom) ───────────────────────────────
          presentationStyle="pageSheet" gives a native iOS sheet feel.
          On Android animationType="slide" suffices.
      ─────────────────────────────────────────────────────────────────── */}
			<Modal
				visible={open}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setOpen(false)}
			>
				<View style={[styles.modalRoot, { paddingTop: 16 }]}>

					{/* Header */}
					<View style={styles.modalHeader}>
						<View style={styles.headerLeft}>
							<View style={styles.onlineDot} />
							<View style={{ flex: 1 }}>
								<Text style={styles.headerTitle} numberOfLines={1}>
									{courseName}
								</Text>
								<Text style={styles.headerSub}>
									Prof. {professorName} · Session Chat
								</Text>
							</View>
						</View>
						<TouchableOpacity
							style={styles.closeBtn}
							onPress={() => setOpen(false)}
							hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
						>
							<Text style={styles.closeBtnText}>✕</Text>
						</TouchableOpacity>
					</View>

					{/* Message list */}
					<FlatList
						ref={flatListRef}
						data={messages}
						keyExtractor={(item, i) => item.message_id + i}
						renderItem={renderMessage}
						contentContainerStyle={styles.msgList}
						keyboardShouldPersistTaps="handled"
						onContentSizeChange={scrollToBottom}
						ListEmptyComponent={
							<View style={styles.emptyState}>
								<Text style={styles.emptyIcon}>💬</Text>
								<Text style={styles.emptyTitle}>No messages yet</Text>
								<Text style={styles.emptySub}>
									Send a message to your professor if you have any concerns
									during this session.
								</Text>
							</View>
						}
					/>

					{/* Input bar */}
					<KeyboardAvoidingView
						behavior={Platform.OS === 'ios' ? 'padding' : undefined}
						keyboardVerticalOffset={0}
					>
						<View style={[
							styles.inputBar,
							{ paddingBottom: 16 },
						]}>
							<TextInput
								style={styles.textInput}
								value={inputText}
								onChangeText={setInputText}
								placeholder="Message professor..."
								placeholderTextColor={COLORS.textMuted}
								multiline
								maxLength={500}
								returnKeyType="send"
								blurOnSubmit={false}
								onSubmitEditing={handleSend}
							/>
							<TouchableOpacity
								style={[styles.sendBtn, !inputText.trim() && styles.sendBtnOff]}
								onPress={handleSend}
								disabled={!inputText.trim()}
								activeOpacity={0.8}
							>
								<Text style={styles.sendIcon}>↑</Text>
							</TouchableOpacity>
						</View>
					</KeyboardAvoidingView>

				</View>
			</Modal>
		</>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const FAB = 56;

const styles = StyleSheet.create({
	// FAB
	fab: {
		position: 'absolute',
		right: 18,
		zIndex: 999,
	},
	fabBtn: {
		width: FAB, height: FAB, borderRadius: FAB / 2,
		backgroundColor: COLORS.primary,
		justifyContent: 'center', alignItems: 'center',
		shadowColor: COLORS.primary,
		shadowOffset: { width: 0, height: 5 },
		shadowOpacity: 0.42, shadowRadius: 10,
		elevation: 10,
	},
	fabIcon: { fontSize: 24 },
	badge: {
		position: 'absolute', top: -3, right: -3,
		minWidth: 20, height: 20, borderRadius: 10,
		backgroundColor: COLORS.danger,
		alignItems: 'center', justifyContent: 'center',
		paddingHorizontal: 4,
		borderWidth: 2, borderColor: COLORS.white,
	},
	badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

	// Modal
	modalRoot: { flex: 1, backgroundColor: '#F5F7FA' },

	// Header
	modalHeader: {
		backgroundColor: COLORS.primary,
		paddingHorizontal: SPACING.md,
		paddingVertical: SPACING.sm,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerLeft: {
		flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
	},
	onlineDot: {
		width: 9, height: 9, borderRadius: 5,
		backgroundColor: '#4ADE80',
		shadowColor: '#4ADE80', shadowRadius: 4, shadowOpacity: 0.8,
		elevation: 2, flexShrink: 0,
	},
	headerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white },
	headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
	closeBtn: {
		width: 30, height: 30, borderRadius: 15,
		backgroundColor: 'rgba(255,255,255,0.18)',
		alignItems: 'center', justifyContent: 'center',
		marginLeft: 8,
	},
	closeBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

	// Messages
	msgList: {
		padding: SPACING.md,
		paddingBottom: SPACING.sm,
		flexGrow: 1,
	},
	msgRow: { flexDirection: 'row', marginBottom: SPACING.xs },
	rowLeft: { justifyContent: 'flex-start' },
	rowRight: { justifyContent: 'flex-end' },
	bubble: {
		maxWidth: '80%', borderRadius: 16,
		paddingHorizontal: 12, paddingVertical: 8,
	},
	bubbleMine: {
		backgroundColor: COLORS.primary, borderBottomRightRadius: 3,
	},
	bubbleProf: {
		backgroundColor: '#E8F5E9',
		borderWidth: 1, borderColor: '#A5D6A7',
		borderBottomLeftRadius: 3,
	},
	bubbleOther: {
		backgroundColor: COLORS.white,
		borderWidth: 1, borderColor: COLORS.border,
		borderBottomLeftRadius: 3,
	},
	profLabel: { fontSize: 10, fontWeight: '800', color: '#2E7D32', marginBottom: 3 },
	msgText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
	msgTextMine: { color: COLORS.white },
	timeText: { fontSize: 9, color: COLORS.textMuted, marginTop: 4, textAlign: 'right' },
	timeTextMine: { color: 'rgba(255,255,255,0.55)' },

	// Empty
	emptyState: {
		flex: 1, alignItems: 'center',
		paddingTop: 60, paddingHorizontal: SPACING.xl,
	},
	emptyIcon: { fontSize: 48 },
	emptyTitle: {
		fontSize: 16, fontWeight: '700',
		color: COLORS.textPrimary, marginTop: 12,
	},
	emptySub: {
		fontSize: 13, color: COLORS.textMuted,
		textAlign: 'center', lineHeight: 20, marginTop: 6,
	},

	// Input
	inputBar: {
		flexDirection: 'row', alignItems: 'flex-end',
		paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm,
		borderTopWidth: 1, borderTopColor: COLORS.border,
		backgroundColor: COLORS.white, gap: 8,
	},
	textInput: {
		flex: 1, backgroundColor: '#F0F2F5',
		borderRadius: 22, paddingHorizontal: SPACING.md,
		paddingVertical: 9, fontSize: 14, maxHeight: 100,
		color: COLORS.textPrimary, lineHeight: 20,
	},
	sendBtn: {
		width: 42, height: 42, borderRadius: 21,
		backgroundColor: COLORS.primary,
		alignItems: 'center', justifyContent: 'center',
		shadowColor: COLORS.primary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
	},
	sendBtnOff: { opacity: 0.32 },
	sendIcon: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginTop: -2 },
});