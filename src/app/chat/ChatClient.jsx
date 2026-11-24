'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Store,
  User as UserIcon,
  MapPin,
  Package,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ExternalLink,
  Zap,
  X,
} from 'lucide-react';
import Badge, {
  PricePill,
  ConditionBadge,
  OrderStatusBadge,
  formatRupiah,
} from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

export default function ChatClient({
  user,
  initialOrderId = null,
  initialStoreId = null,
  initialProductId = null,
  initialBuyerId = null,
}) {
  const router = useRouter();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [activeTarget, setActiveTarget] = useState(() => {
    if (initialOrderId) {
      return {
        type: 'order',
        orderId: initialOrderId,
        productId: initialProductId || null,
      };
    }
    if (initialStoreId) {
      return {
        type: initialProductId ? 'inquiry' : 'room',
        storeId: initialStoreId,
        productId: initialProductId || null,
        buyerId: initialBuyerId || null,
      };
    }
    return null;
  });

  const [activeChat, setActiveChat] = useState(null);
  const [isProductBannerDismissed, setIsProductBannerDismissed] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [productImgError, setProductImgError] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  const getChatQueryUrl = useCallback((target) => {
    if (!target) return null;
    if (target.type === 'order' && target.orderId) {
      return `/api/chat?order_id=${target.orderId}${
        target.productId ? `&product_id=${target.productId}` : ''
      }`;
    }
    if (target.storeId) {
      let url = `/api/chat?store_id=${target.storeId}`;
      if (target.productId) url += `&product_id=${target.productId}`;
      if (target.buyerId) url += `&buyer_id=${target.buyerId}`;
      return url;
    }
    return null;
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const pollActiveChat = useCallback(
    async (target) => {
      const url = getChatQueryUrl(target);
      if (!url) return;

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setActiveChat((prev) => {
            const prevLen = prev?.messages?.length || 0;
            const nextLen = data.messages?.length || 0;
            if (nextLen > prevLen) {
              setTimeout(() => scrollToBottom('smooth'), 100);
            }
            return data;
          });
        }
      } catch (err) {
        console.error('Poll active chat error:', err);
      }
    },
    [getChatQueryUrl]
  );

  const [prevNavParams, setPrevNavParams] = useState({
    orderId: initialOrderId,
    storeId: initialStoreId,
    productId: initialProductId,
    buyerId: initialBuyerId,
  });

  if (
    initialOrderId !== prevNavParams.orderId ||
    initialStoreId !== prevNavParams.storeId ||
    initialProductId !== prevNavParams.productId ||
    initialBuyerId !== prevNavParams.buyerId
  ) {
    setPrevNavParams({
      orderId: initialOrderId,
      storeId: initialStoreId,
      productId: initialProductId,
      buyerId: initialBuyerId,
    });
    setIsProductBannerDismissed(false);
    setProductImgError(false);

    if (initialOrderId) {
      const nextTarget = {
        type: 'order',
        orderId: initialOrderId,
        productId: initialProductId || null,
      };
      setActiveTarget((prev) =>
        prev?.type === nextTarget.type &&
        prev?.orderId === nextTarget.orderId &&
        prev?.productId === nextTarget.productId
          ? prev
          : nextTarget
      );
    } else if (initialStoreId) {
      const nextTarget = {
        type: initialProductId ? 'inquiry' : 'room',
        storeId: initialStoreId,
        productId: initialProductId || null,
        buyerId: initialBuyerId || null,
      };
      setActiveTarget((prev) =>
        prev?.storeId === nextTarget.storeId &&
        prev?.type === nextTarget.type &&
        prev?.productId === nextTarget.productId &&
        (prev?.buyerId || null) === nextTarget.buyerId
          ? prev
          : nextTarget
      );
    }
  }

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch('/api/chat');
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            const list = data.conversations || [];
            setConversations(list);

            setActiveTarget((curr) => {
              if (curr) return curr;
              if (list.length > 0) {
                const first = list[0];
                return {
                  type: 'room',
                  storeId: first.store_id,
                  buyerId: first.buyer_id || null,
                };
              }
              return null;
            });
          }
        }
      } catch (err) {
        console.error('Init conversations error:', err);
      } finally {
        if (!ignore) {
          setLoadingList(false);
        }
      }
    }

    init();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const url = getChatQueryUrl(activeTarget);
    if (!url) return;

    let ignore = false;
    const startTimer = setTimeout(() => {
      if (!ignore) setLoadingChat(true);
    }, 0);

    async function loadChat() {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setActiveChat(data);
            setTimeout(() => scrollToBottom('auto'), 150);
          }
        }
      } catch (err) {
        console.error('Load chat error:', err);
      } finally {
        if (!ignore) {
          setLoadingChat(false);
        }
      }
    }

    loadChat();

    return () => {
      ignore = true;
      clearTimeout(startTimer);
    };
  }, [activeTarget, getChatQueryUrl]);

  useEffect(() => {
    if (!activeTarget) return;
    const interval = setInterval(() => {
      pollActiveChat(activeTarget);
    }, 3500);

    return () => clearInterval(interval);
  }, [activeTarget, pollActiveChat]);

  const ordersList = activeChat?.orders || (activeChat?.order ? [activeChat.order] : []);
  const roomMode = activeChat?.type || 'general';
  const displayedOrder = roomMode === 'order' ? activeChat?.order || null : null;
  const displayedItems = displayedOrder?.items || activeChat?.items || [];
  const displayedProduct =
    roomMode === 'inquiry' && !isProductBannerDismissed ? activeChat?.product || null : null;
  const displayedMode =
    roomMode === 'inquiry' && isProductBannerDismissed ? 'general' : roomMode;

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || !activeTarget || sending) return;

    if (!activeChat?.currentUser?.isBuyer && !activeChat?.partner?.id) {
      toast.info('Belum ada pembeli yang menghubungi toko ini untuk dibalas.');
      return;
    }

    setSending(true);
    setMessageText('');

    try {
      const payload = { message: trimmed };
      if (displayedMode === 'order' && displayedOrder?.id) {
        payload.order_id = displayedOrder.id;
      } else {
        payload.store_id = activeChat?.store?.id || activeTarget.storeId;
        payload.product_id =
          displayedMode === 'inquiry' ? displayedProduct?.id || activeTarget.productId || null : null;
        if (activeChat?.partner?.id) {
          payload.recipient_id = activeChat.partner.id;
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal mengirim pesan');
        setMessageText(trimmed);
        setSending(false);
        return;
      }

      if (data.message) {
        setActiveChat((prev) => ({
          ...prev,
          messages: [...(prev?.messages || []), data.message],
        }));
        setTimeout(() => scrollToBottom('smooth'), 50);
      }

      fetchConversations();
    } catch (err) {
      console.error('Send message error:', err);
      toast.error('Terjadi gangguan jaringan');
      setMessageText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (conv) => {
    const activeStoreId = activeChat?.store?.id || activeTarget?.storeId;
    const activeBuyerId =
      activeChat?.currentUser?.isBuyer
        ? user.id
        : activeChat?.partner?.id || activeTarget?.buyerId;

    const isSameRoom =
      activeStoreId === conv.store_id &&
      (!conv.buyer_id || !activeBuyerId || activeBuyerId === conv.buyer_id);

    if (isSameRoom) return;

    const isOwnerOfStore = user.store_id && user.store_id === conv.store_id;

    setIsProductBannerDismissed(false);
    setProductImgError(false);
    setActiveChat(null);
    setLoadingChat(true);

    setActiveTarget({
      type: 'room',
      storeId: conv.store_id,
      productId: null,
      buyerId: isOwnerOfStore ? conv.buyer_id || null : null,
    });

    const url = `/chat?store_id=${conv.store_id}${
      isOwnerOfStore && conv.buyer_id ? `&buyer_id=${conv.buyer_id}` : ''
    }`;
    router.replace(url, { scroll: false });
  };

  const handleSendQuickReply = (text) => {
    setMessageText(text);
  };

  // Gabungkan room yang sedang dibuka via URL jika belum memiliki pesan sama sekali di inbox
  const displayConversations = [...conversations];
  const currentRoomStoreId = activeChat?.store?.id || activeTarget?.storeId || null;
  const currentRoomBuyerId = activeChat?.currentUser?.isBuyer
    ? user.id
    : activeChat?.partner?.id || activeTarget?.buyerId || null;

  if (activeTarget && activeChat?.store && currentRoomStoreId) {
    const alreadyExists = conversations.some(
      (c) =>
        c.store_id === currentRoomStoreId &&
        (!currentRoomBuyerId || c.buyer_id === currentRoomBuyerId)
    );

    if (!alreadyExists) {
      const isOwner = user.store_id && user.store_id === activeChat.store.id;
      const latestMsg =
        activeChat.messages?.length > 0
          ? activeChat.messages[activeChat.messages.length - 1]
          : null;
      const firstOrder = ordersList[0] || null;

      displayConversations.unshift({
        store_id: activeChat.store.id,
        buyer_id: currentRoomBuyerId,
        latest_order_id: firstOrder?.id || null,
        latest_order_code: firstOrder?.order_code || null,
        latest_order_status: firstOrder?.status || null,
        latest_order_delivery_method: firstOrder?.delivery_method || null,
        last_chat_order_id: firstOrder?.id || null,
        total_orders_count: ordersList.length,
        active_orders_count: ordersList.filter((o) =>
          ['pending_payment', 'processing', 'shipped'].includes(o.status)
        ).length,
        searchable_order_codes: ordersList.map((o) => o.order_code).join(' '),
        store_name: activeChat.store.store_display_name,
        buyer_name: isOwner
          ? activeChat.partner?.role === 'buyer'
            ? activeChat.partner.name
            : 'Belum ada pembeli'
          : user.name,
        campus_short_name: activeChat.store.campus_short_name,
        product_id: activeChat.product?.id || activeTarget.productId || null,
        product_name: activeChat.product?.name || null,
        last_message: latestMsg ? latestMsg.message : 'Mulai obrolan di sini...',
        last_message_time: latestMsg ? latestMsg.created_at : null,
        message_count: activeChat.messages?.length || 0,
      });
    }
  }

  const filteredConversations = displayConversations.filter((c) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      c.latest_order_code?.toLowerCase().includes(q) ||
      c.searchable_order_codes?.toLowerCase().includes(q) ||
      c.store_name?.toLowerCase().includes(q) ||
      c.buyer_name?.toLowerCase().includes(q) ||
      c.product_name?.toLowerCase().includes(q) ||
      c.campus_short_name?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  const getObjectiveQuickReplies = () => {
    if (!activeChat) return [];

    if (!activeChat.currentUser?.isBuyer && !activeChat.partner?.id) {
      return [];
    }

    const isBuyer = activeChat.currentUser?.isBuyer;

    if (displayedMode === 'general') {
      if (isBuyer) {
        return [
          'Halo kak, barang di lapak masih ready?',
          'Bisa COD di sekitar kampus?',
          'Apakah harga masih bisa nego?',
          'Jam berapa biasanya bisa ketemuan?',
        ];
      }
      return [
        'Halo kak, ada yang bisa dibantu?',
        'Barang yang di etalase masih tersedia ya kak.',
        'Bisa COD di sekitar kampus ya.',
        'Silakan kabari jika berminat checkout ya kak.',
      ];
    }

    if (displayedMode === 'inquiry' || !displayedOrder) {
      if (isBuyer) {
        return [
          'Halo kak, barang ini masih tersedia?',
          'Bisa nego tipis kak?',
          'Bisa COD di sekitar kampus?',
          'Apakah barang ada minus/cacat?',
        ];
      } else {
        return [
          'Halo kak, barangnya masih ada ya.',
          'Harga sudah pas/nett ya kak.',
          'Bisa COD di sekitar kampus ya.',
          'Kondisi barang sesuai deskripsi.',
        ];
      }
    }

    const isMeetup = displayedOrder.delivery_method === 'meetup';
    const campus = displayedOrder.campus_short_name || activeChat.store?.campus_short_name;

    if (isMeetup) {
      if (isBuyer) {
        return [
          'Siap COD hari ini?',
          'Bisa ketemuan jam berapa?',
          campus ? `Ketemuan di Perpustakaan (${campus})?` : 'Ketemuan di Perpustakaan Pusat?',
          campus ? `Ketemuan di Gerbang Utama (${campus})?` : 'Ketemuan di Pintu Gerbang Utama?',
          'Saya sudah di titik temu COD.',
        ];
      } else {
        return [
          'Barang siap untuk COD hari ini.',
          'Bisa ketemuan jam berapa?',
          campus ? `Standby di Perpustakaan (${campus}).` : 'Standby di Perpustakaan Pusat.',
          campus ? `Standby di Gerbang Utama (${campus}).` : 'Standby di Pintu Gerbang Utama.',
          'Saya sudah di titik temu COD.',
        ];
      }
    } else {
      if (isBuyer) {
        return [
          'Kapan paket dikirim ke kost?',
          'Sudah dibayar saat checkout ya kak.',
          'Apakah ada info pengiriman?',
          'Paket sudah tiba, terima kasih.',
        ];
      } else {
        return [
          'Pesanan sedang disiapkan.',
          'Paket segera dikirim ke kost.',
          'Paket sudah dalam perjalanan.',
          'Mohon konfirmasi jika barang tiba.',
        ];
      }
    }
  };

  const getMessageContextInfo = (msg) => {
    if (msg.order_id) {
      return {
        key: `order-${msg.order_id}`,
        label: `Pesanan #${msg.context_order_code || msg.order_id}`,
      };
    }
    if (msg.product_id) {
      return {
        key: `product-${msg.product_id}`,
        label: msg.context_product_name
          ? `Tanya Produk: ${msg.context_product_name}`
          : 'Tanya Produk',
      };
    }
    return { key: 'general', label: '' };
  };

  return (
    <div className="w-full h-full min-h-0 surface-3d sm:rounded-2xl flex flex-col md:flex-row overflow-hidden">
      {/* Kolom Kiri: Daftar Percakapan (1 Room per Pasangan Pembeli <-> Toko) */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-border-subtle bg-canvas h-full overflow-hidden ${
          activeTarget ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Bar Kiri: Sejajar persis dengan Top Bar Kanan (h-[65px]) */}
        <div className="h-[65px] min-h-[65px] px-4 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
          <h1 className="text-base font-bold text-ink flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-brand-blue" aria-hidden="true" />
            <span>Pesan dan Koordinasi</span>
          </h1>
          <span className="text-xs font-semibold bg-brand-blue-soft text-brand-blue px-2 py-0.5 rounded-md tabular-nums">
            {displayConversations.length}
          </span>
        </div>

        {/* Sub-bar Filter Pencarian */}
        <div className="p-3 border-b border-border-subtle bg-canvas shrink-0">
          <label htmlFor="chat-search-input" className="sr-only">
            Cari percakapan
          </label>
          <input
            id="chat-search-input"
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Cari toko, barang, atau pembeli..."
            className="w-full h-9 text-base md:text-xs px-3 bg-surface text-ink placeholder:text-ink-muted rounded-xl border border-border-subtle focus:bg-surface focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-soft outline-none transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
          {loadingList ? (
            <div className="p-8 text-center text-xs text-ink-muted">Memuat percakapan...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted flex flex-col items-center gap-2">
              <MessageCircle className="w-8 h-8 text-ink-muted" aria-hidden="true" />
              <span className="font-semibold text-ink-secondary">
                {searchFilter.trim()
                  ? 'Tidak ada percakapan ditemukan'
                  : 'Belum ada riwayat percakapan'}
              </span>
              {!searchFilter.trim() && (
                <p className="text-[11px] text-ink-muted max-w-[220px] leading-relaxed">
                  Obrolan akan muncul di sini setelah ada pesan tanya produk atau koordinasi pesanan.
                </p>
              )}
            </div>
          ) : (
            filteredConversations.map((c, idx) => {
              const isUserTheBuyer =
                user.store_id && user.store_id === c.store_id ? false : c.buyer_id === user.id;

              const isSelected =
                Boolean(activeTarget) &&
                currentRoomStoreId === c.store_id &&
                (!c.buyer_id || !currentRoomBuyerId || currentRoomBuyerId === c.buyer_id);

              const partnerName = isUserTheBuyer ? c.store_name : c.buyer_name || 'Pembeli';
              const hasOrders = Number(c.total_orders_count || 0) > 0 && Boolean(c.latest_order_code);
              const key = `room-${c.store_id}-${c.buyer_id || idx}`;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectConversation(c)}
                  className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                    isSelected ? 'bg-brand-blue-soft border-l-4 border-brand-blue' : 'hover:bg-surface'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-surface border border-border-subtle flex items-center justify-center shrink-0 text-brand-blue font-bold">
                    {isUserTheBuyer ? (
                      <Store className="w-5 h-5 text-brand-blue" aria-hidden="true" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-navy-900" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-ink truncate">{partnerName}</span>
                      <span className="text-[11px] text-ink-muted tabular-nums shrink-0">
                        {c.last_message_time
                          ? new Date(c.last_message_time).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      {Number(c.active_orders_count || 0) > 0 && c.latest_order_code ? (
                        <>
                          <span className="text-[11px] tabular-nums font-semibold text-ink-secondary">
                            #{c.latest_order_code}
                          </span>
                          {c.campus_short_name && (
                            <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-soft px-1.5 py-0.5 rounded-md">
                              {c.campus_short_name}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                              c.latest_order_delivery_method === 'meetup'
                                ? 'bg-info-bg text-navy-900'
                                : 'bg-warning-bg text-warning-text'
                            }`}
                          >
                            {c.latest_order_delivery_method === 'meetup' ? 'COD' : 'Kirim'}
                          </span>
                          {Number(c.active_orders_count) > 1 && (
                            <span className="text-[10px] font-semibold text-ink-muted bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle tabular-nums">
                              +{Number(c.active_orders_count) - 1} aktif
                            </span>
                          )}
                        </>
                      ) : c.product_name ? (
                        <>
                          <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-soft px-1.5 py-0.5 rounded-md">
                            Tanya Produk
                          </span>
                          <span className="text-[11px] font-medium text-ink-muted truncate max-w-[120px]">
                            {c.product_name}
                          </span>
                          {c.campus_short_name && (
                            <span className="text-[11px] font-semibold text-ink-secondary bg-surface-muted px-1.5 py-0.5 rounded-md">
                              {c.campus_short_name}
                            </span>
                          )}
                        </>
                      ) : hasOrders ? (
                        <>
                          <span className="text-[11px] tabular-nums font-semibold text-ink-secondary">
                            #{c.latest_order_code}
                          </span>
                          {c.campus_short_name && (
                            <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-soft px-1.5 py-0.5 rounded-md">
                              {c.campus_short_name}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-soft px-1.5 py-0.5 rounded-md">
                            Obrolan Toko
                          </span>
                          {c.campus_short_name && (
                            <span className="text-[11px] font-semibold text-ink-secondary bg-surface-muted px-1.5 py-0.5 rounded-md">
                              {c.campus_short_name}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <p className="text-xs text-ink-muted truncate mt-1">
                      {c.last_message || 'Mulai obrolan di sini...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Kolom Kanan: Ruang Chat Aktif */}
      <div
        className={`flex-1 flex flex-col bg-surface min-w-0 h-full overflow-hidden ${
          !activeTarget ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}
      >
        {!activeTarget ? (
          <>
            <div className="h-[65px] min-h-[65px] px-4 border-b border-border-subtle bg-surface hidden md:flex items-center shrink-0">
              <span className="text-xs font-semibold text-ink-muted">Ruang Percakapan</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-xl bg-brand-blue-soft text-brand-blue border border-brand-blue-border flex items-center justify-center mb-4">
                <MessageCircle className="w-7 h-7" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-ink mb-1">Pilih Percakapan</h2>
              <p className="text-xs text-ink-muted">
                Pilih salah satu percakapan di daftar kiri untuk melihat riwayat obrolan atau koordinasi pesanan.
              </p>
            </div>
          </>
        ) : loadingChat && !activeChat ? (
          <>
            <div className="h-[65px] min-h-[65px] px-4 border-b border-border-subtle bg-surface hidden md:flex items-center shrink-0">
              <span className="text-xs font-semibold text-ink-muted">Memuat percakapan...</span>
            </div>
            <div className="flex-1 flex items-center justify-center text-xs text-ink-muted">
              Memuat ruang obrolan...
            </div>
          </>
        ) : activeChat ? (
          <>
            {/* Top Bar Chat: Sejajar persis dengan Top Bar Kiri (h-[65px]) */}
            <div className="h-[65px] min-h-[65px] px-4 border-b border-border-subtle flex items-center justify-between gap-3 bg-surface shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTarget(null);
                    setIsProductBannerDismissed(false);
                    router.replace('/chat', { scroll: false });
                  }}
                  className="md:hidden w-11 h-11 -ml-1.5 rounded-lg hover:bg-surface-muted text-ink-secondary hover:text-ink flex items-center justify-center shrink-0"
                  aria-label="Kembali ke daftar pesan"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>

                <div className="w-9 h-9 rounded-lg bg-brand-blue-soft text-brand-blue flex items-center justify-center shrink-0 font-bold">
                  {activeChat.currentUser?.isBuyer ? (
                    <Store className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <UserIcon className="w-4 h-4" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-ink truncate">
                      {activeChat.partner?.name}
                    </h2>
                    <Badge variant="secondary" size="xs" className="shrink-0">
                      {activeChat.partner?.role === 'seller' ? 'Penjual' : 'Pembeli'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted mt-0.5">
                    {displayedMode === 'order' && displayedOrder ? (
                      <>
                        <span className="tabular-nums font-semibold text-ink-secondary">
                          #{displayedOrder.order_code}
                        </span>
                        {displayedOrder.campus_short_name && (
                          <span className="bg-brand-blue-soft text-brand-blue font-semibold text-[11px] px-1.5 py-0.5 rounded-md">
                            {displayedOrder.campus_short_name}
                          </span>
                        )}
                        <OrderStatusBadge
                          status={displayedOrder.status}
                          deliveryMethod={displayedOrder.delivery_method}
                          className="text-[11px] py-0 px-2"
                        />
                      </>
                    ) : (
                      <>
                        <span className="bg-brand-blue-soft text-brand-blue font-semibold text-[11px] px-1.5 py-0.5 rounded-md">
                          {displayedMode === 'inquiry' ? 'Tanya Produk' : 'Obrolan Toko'}
                        </span>
                        {activeChat.store?.campus_short_name && (
                          <span className="bg-surface-muted text-ink-secondary font-semibold text-[11px] px-1.5 py-0.5 rounded-md">
                            {activeChat.store.campus_short_name}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {displayedMode === 'order' && displayedOrder ? (
                <button
                  type="button"
                  onClick={() => setIsOrderSummaryOpen(!isOrderSummaryOpen)}
                  className="flex items-center gap-1 min-h-[38px] text-xs font-semibold text-brand-blue hover:bg-brand-blue-soft px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  <span>{isOrderSummaryOpen ? 'Tutup Detail' : 'Detail Pesanan'}</span>
                  {isOrderSummaryOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              ) : activeChat.currentUser?.isBuyer && activeChat.store?.id ? (
                <Link
                  href={`/stores/${activeChat.store.id}`}
                  className="text-xs font-semibold text-ink-secondary hover:text-brand-blue px-3 py-2 min-h-[38px] rounded-lg hover:bg-canvas border border-border-subtle transition-colors shrink-0 inline-flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kunjungi Toko</span>
                </Link>
              ) : null}
            </div>

            {/* Banner Konteks Produk (Pra-Order / Tanya Produk) */}
            {displayedMode === 'inquiry' && displayedProduct && (
              <div className="bg-canvas border-b border-border-subtle px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-lg bg-surface-muted border border-border-subtle overflow-hidden shrink-0">
                    {!productImgError && displayedProduct.image_url ? (
                      <Image
                        src={displayedProduct.image_url}
                        alt={displayedProduct.name}
                        fill
                        unoptimized
                        onError={() => setProductImgError(true)}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-muted">
                        <Package className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-soft px-2 py-0.5 rounded-md">
                        Produk Ditanyakan
                      </span>
                      {displayedProduct.condition && (
                        <ConditionBadge condition={displayedProduct.condition} />
                      )}
                    </div>
                    <h3 className="text-xs md:text-sm font-semibold text-ink truncate mt-1">
                      {displayedProduct.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <PricePill amount={displayedProduct.price} size="sm" />
                      <span className="text-xs text-ink-muted tabular-nums">
                        Stok: <strong className="text-ink">{displayedProduct.stock}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <Link
                    href={
                      activeChat.currentUser?.isBuyer
                        ? `/products/${displayedProduct.id}`
                        : `/seller/products/${displayedProduct.id}/edit`
                    }
                    className="text-xs font-semibold text-brand-blue hover:bg-brand-blue hover:text-white px-3 py-2 min-h-[38px] rounded-lg border border-brand-blue-border bg-brand-blue-soft transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <span>{activeChat.currentUser?.isBuyer ? 'Lihat Produk' : 'Kelola Produk'}</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsProductBannerDismissed(true)}
                    className="w-9 h-[38px] rounded-lg border border-border-subtle bg-surface text-ink-muted hover:text-ink hover:bg-surface-muted inline-flex items-center justify-center transition-colors"
                    aria-label="Tutup banner produk"
                    title="Tutup kartu produk"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Banner Ringkasan Pesanan */}
            {displayedMode === 'order' && displayedOrder && isOrderSummaryOpen && (
              <div className="bg-canvas border-b border-border-subtle px-4 py-3 text-xs flex flex-col gap-2.5 shrink-0">
                {displayedOrder.delivery_method === 'meetup' && (
                  <div className="bg-info-bg border border-brand-blue-border rounded-lg p-3 flex items-start gap-2 text-ink">
                    <MapPin className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 text-xs leading-relaxed">
                      <strong className="text-navy-900 font-bold block mb-0.5">
                        Titik Temu COD Kampus{' '}
                        {displayedOrder.campus_name ? `(${displayedOrder.campus_name})` : ''}
                      </strong>
                      Sepakati titik temu yang aman dan ramai di area kampus (Perpustakaan, Pintu Gerbang Utama, atau Kantin Fakultas) dan cek kondisi barang sebelum menyelesaikan pesanan.
                    </div>
                  </div>
                )}

                {displayedOrder.delivery_method === 'delivery' && (
                  <div className="bg-surface border border-border-subtle rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                      <span>
                        Tujuan Kost:{' '}
                        <strong>
                          {displayedOrder.shipping_address || 'Alamat pembeli'}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-success-text bg-success-bg px-2.5 py-0.5 rounded-md">
                      Lunas saat Checkout
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1 border-t border-border-subtle text-xs">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    <span className="text-ink-muted">Barang:</span>
                    {displayedItems.map((it, idx) => (
                      <span key={idx} className="font-semibold text-ink whitespace-nowrap">
                        {it.product_name} (x{it.quantity})
                        {idx < displayedItems.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                  <div className="font-bold text-ink tabular-nums">
                    Total:{' '}
                    <span className="text-brand-blue font-bold">
                      {formatRupiah(displayedOrder.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Area Pesan Obrolan (Timeline Terpadu) */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-canvas"
            >
              {activeChat.messages?.length === 0 ? (
                <div className="my-auto text-center p-6 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-brand-blue-soft text-brand-blue border border-brand-blue-border flex items-center justify-center mb-3">
                    {displayedMode === 'order' ? (
                      <MessageSquare className="w-6 h-6" aria-hidden="true" />
                    ) : (
                      <MessageCircle className="w-6 h-6" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-ink">
                    {!activeChat.currentUser?.isBuyer && !activeChat.partner?.id
                      ? 'Belum Ada Calon Pembeli yang Bertanya'
                      : displayedMode === 'order'
                      ? 'Mulai Percakapan Pesanan'
                      : displayedMode === 'inquiry'
                      ? 'Mulai Tanya Produk ke Penjual'
                      : 'Mulai Obrolan dengan Penjual'}
                  </p>
                  <p className="text-xs text-ink-muted max-w-xs mt-1">
                    {!activeChat.currentUser?.isBuyer && !activeChat.partner?.id
                      ? 'Ketika ada pembeli menghubungi tokomu, pesan akan tampil di sini.'
                      : displayedMode === 'order'
                      ? 'Sepakati waktu dan titik ketemuan COD di kampus secara aman.'
                      : 'Tanyakan ketersediaan barang, detail kondisi, atau titik temu COD.'}
                  </p>
                </div>
              ) : (
                activeChat.messages?.map((msg, idx) => {
                  const isMe = msg.sender_id === user.id;
                  const timeFormatted = new Date(msg.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const ctx = getMessageContextInfo(msg);
                  const prevCtx =
                    idx > 0
                      ? getMessageContextInfo(activeChat.messages[idx - 1])
                      : { key: null };
                  const showContextPill = ctx.key !== 'general' && ctx.key !== prevCtx.key;

                  return (
                    <div key={msg.id} className="flex flex-col gap-2">
                      {showContextPill && (
                        <div className="flex justify-center my-1">
                          <span className="text-[11px] font-medium text-ink-muted bg-surface border border-border-subtle px-2.5 py-0.5 rounded-full">
                            {ctx.label}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex flex-col max-w-[82%] md:max-w-[70%] ${
                          isMe ? 'self-end items-end' : 'self-start items-start'
                        }`}
                      >
                        {!isMe && (
                          <span className="text-[11px] font-semibold text-ink-muted ml-1 mb-0.5">
                            {msg.sender_name}
                          </span>
                        )}
                        <div
                          className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                            isMe
                              ? 'bg-navy-900 text-white rounded-br-none'
                              : 'bg-surface text-ink border border-border-subtle rounded-bl-none'
                          }`}
                        >
                          {msg.message}
                        </div>
                        <span className="text-[11px] text-ink-muted tabular-nums mt-1 px-1">
                          {timeFormatted}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pesan Cepat (Single-Row Horizontal Scrollable Capsule Chips) */}
            {getObjectiveQuickReplies().length > 0 && (
              <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-t border-border-subtle bg-surface shrink-0 overflow-x-auto no-scrollbar">
                {getObjectiveQuickReplies().map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendQuickReply(chip)}
                    className="h-[30px] px-3 text-xs font-medium rounded-full bg-canvas text-ink-secondary border border-border-subtle hover:bg-brand-blue-soft hover:text-brand-blue hover:border-brand-blue-border active:scale-95 transition-all shrink-0 whitespace-nowrap"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Form Kirim Pesan */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 bg-surface border-t border-border-subtle shrink-0"
            >
              <label htmlFor="chat-message-input" className="sr-only">
                Ketik pesan
              </label>
              <input
                id="chat-message-input"
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={Boolean(!activeChat.currentUser?.isBuyer && !activeChat.partner?.id)}
                placeholder={
                  !activeChat.currentUser?.isBuyer && !activeChat.partner?.id
                    ? 'Belum ada pembeli untuk dibalas...'
                    : displayedMode === 'order'
                    ? 'Ketik pesan untuk koordinasi...'
                    : displayedMode === 'inquiry'
                    ? 'Ketik pertanyaan tentang produk ini...'
                    : activeChat.currentUser?.isBuyer
                    ? 'Ketik pesan untuk penjual...'
                    : 'Ketik balasan untuk pembeli...'
                }
                className="flex-1 min-w-0 h-11 px-3.5 bg-canvas border border-border-subtle rounded-lg focus:outline-none focus:ring-3 focus:ring-brand-blue-soft focus:border-brand-blue text-base md:text-sm text-ink transition-colors disabled:opacity-60 disabled:bg-surface-muted"
              />
              <button
                type="submit"
                disabled={
                  !messageText.trim() ||
                  sending ||
                  Boolean(!activeChat.currentUser?.isBuyer && !activeChat.partner?.id)
                }
                className="h-11 px-4 md:px-5 rounded-lg bg-brand-blue hover:bg-brand-blue-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white text-xs md:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>Kirim</span>
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
