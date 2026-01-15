import {
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestSubscription,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  Purchase,
  Subscription,
  PurchaseError,
  flushFailedPurchasesCachedAsPendingAndroid,
  getPurchaseHistory,
} from 'react-native-iap';
import { Platform, EmitterSubscription } from 'react-native';
import apiClient from '../lib/apiClient';
import { eventManager } from './EventManager';

// TODO: Switch to 'blockstracker_premium_monthly' when verified
const PRODUCT_ID = 'android.test.purchased';
// const PRODUCT_ID = 'blockstracker_premium_monthly';

class IAPService {
  private purchaseUpdateSubscription: EmitterSubscription | null = null;
  private purchaseErrorSubscription: EmitterSubscription | null = null;
  private isConnected = false;

  /**
   * Initialize the connection to the app store.
   * Should be called when the app starts or when entering the paywall.
   */
  public async initialize(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await initConnection();
      this.isConnected = true;

      if (Platform.OS === 'android') {
        // Safety: clear any pending failed transactions to avoid stuck states
        await flushFailedPurchasesCachedAsPendingAndroid();
      }

      this.setupListeners();
      console.log('[IAPService] Connected to store.');
    } catch (error) {
      console.error('[IAPService] Connection failed:', error);
    }
  }

  /**
   * Fetches the subscription details (price, currency, etc.)
   * Note: 'android.test.purchased' will NOT return data here, so we return null
   * and handle the UI fallback in the component.
   */
  public async getSubscriptionDetails(): Promise<Subscription | null> {
    if (!this.isConnected) {
      await this.initialize();
    }

    if (PRODUCT_ID === 'android.test.purchased') {
      console.log('[IAPService] Using test ID, skipping fetch.');
      return null;
    }

    try {
      const subscriptions = await getSubscriptions({ skus: [PRODUCT_ID] });
      return subscriptions[0] || null;
    } catch (error) {
      console.error('[IAPService] Failed to fetch products:', error);
      return null;
    }
  }

  /**
   * Triggers the purchase flow.
   */
  public async requestPurchase(): Promise<void> {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      console.log(`[IAPService] Requesting purchase for: ${PRODUCT_ID}`);

      if (PRODUCT_ID === 'android.test.purchased') {
        // The test ID is a "managed product", not a subscription
        console.log('[IAPService] Fetching products for test ID...');
        const products = await getProducts({ skus: [PRODUCT_ID] });
        console.log('[IAPService] Products fetched:', products);
        if (!products || products.length === 0) {
          console.warn(
            '[IAPService] Test product details not found. Simulating purchase for development.',
          );
          // Mock a successful purchase response to unblock development
          const mockPurchase: Purchase = {
            productId: PRODUCT_ID,
            transactionId: 'mock-transaction-id',
            transactionDate: Date.now(),
            transactionReceipt: 'mock-receipt-data',
            purchaseToken: 'mock-purchase-token',
            dataAndroid:
              '{"orderId":"mock-order-id","packageName":"com.blockstrackerapp","productId":"android.test.purchased","purchaseTime":1600000000000,"purchaseState":0,"purchaseToken":"mock-purchase-token"}',
            signatureAndroid: 'mock-signature',
            autoRenewingAndroid: false,
            purchaseStateAndroid: 1,
            isAcknowledgedAndroid: false,
            packageNameAndroid: 'com.blockstrackerapp',
          };
          await this.handlePurchaseSuccess(mockPurchase);
          return;
        }
        await requestPurchase({ skus: [PRODUCT_ID] });
      } else {
        const subscriptions = await getSubscriptions({ skus: [PRODUCT_ID] });
        if (subscriptions.length > 0) {
          const subscription = subscriptions[0] as any;
          const offerToken =
            subscription.subscriptionOfferDetails?.[0]?.offerToken;
          await requestSubscription({
            sku: PRODUCT_ID,
            ...(offerToken && {
              subscriptionOffers: [{ sku: PRODUCT_ID, offerToken }],
            }),
          });
        } else {
          throw new Error('Subscription product not found.');
        }
      }
    } catch (error) {
      console.error('[IAPService] Purchase request failed:', error);
      throw error;
    }
  }

  /**
   * Restores past purchases.
   * Fetches purchase history and validates the most recent subscription receipt.
   */
  public async restorePurchases(): Promise<void> {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      console.log('[IAPService] Restoring purchases...');
      const history = await getPurchaseHistory();
      console.log('[IAPService] Purchase history fetched:', history);

      const purchase = history.find(p => p.productId === PRODUCT_ID);

      // MOCK LOGIC: If using test ID and no history found, simulate a restore
      if (!purchase && PRODUCT_ID === 'android.test.purchased') {
        console.log(
          '[IAPService] No history found, simulating restore for test ID.',
        );
        await this.validateReceiptWithBackend({
          productId: PRODUCT_ID,
          purchaseToken: 'mock-purchase-token',
          transactionDate: Date.now(),
          transactionId: 'mock-restore-id',
        } as Purchase);
        return;
      }

      if (purchase) {
        console.log('[IAPService] Found purchase to restore:', purchase);
        await this.validateReceiptWithBackend(purchase);
      } else {
        throw new Error('No active subscription found to restore.');
      }
    } catch (error) {
      console.error('[IAPService] Restore failed:', error);
      throw error;
    }
  }

  /**
   * Sets up global listeners for purchase events.
   * This handles the result coming back from Google Play.
   */
  private setupListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        console.log('[IAPService] Purchase update received:', purchase);
        await this.handlePurchaseSuccess(purchase);
      },
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.warn('[IAPService] Purchase error:', error);
      },
    );
  }

  private async handlePurchaseSuccess(purchase: Purchase): Promise<void> {
    const receipt = purchase.transactionReceipt;
    if (receipt) {
      try {
        // 1. Validate with our backend
        await this.validateReceiptWithBackend(purchase);

        // 2. Tell Google we have delivered the content
        // If we don't do this, Google will refund the user after 3 days.
        // Only call finishTransaction if it's a real purchase (has a real token)
        if (purchase.purchaseToken !== 'mock-purchase-token') {
          await finishTransaction({ purchase, isConsumable: false });
        }

        console.log('[IAPService] Transaction finished and acknowledged.');
      } catch (error) {
        console.error('[IAPService] Backend validation failed:', error);
        // Do NOT finish transaction here; let it retry later
      }
    }
  }

  /**
   * Sends the token to our backend for verification.
   */
  private async validateReceiptWithBackend(purchase: Purchase): Promise<void> {
    console.log(
      '[IAPService] Validating receipt with backend...',
      purchase.purchaseToken,
    );

    try {
      const response = await apiClient.post('/billing/google/verify', {
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productId,
      });
      console.log('[IAPService] Backend verification response:', response.data);

      const { accessToken, refreshToken } = response.data.result.data;
      if (accessToken && refreshToken) {
        console.log(
          '[IAPService] Backend verification successful. Refreshing session...',
        );
        eventManager.emit('PREMIUM_STATUS_UPDATED', {
          accessToken,
          refreshToken,
        });
      }

      // Note: The backend should update the user's 'is_premium' status in the DB.
      // The client might need to refresh the user profile/token after this to see the change immediately.
    } catch (error) {
      console.error('[IAPService] Backend verification failed:', error);
      throw error;
    }
  }

  public teardown(): void {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
    endConnection();
    this.isConnected = false;
  }
}

export const iapService = new IAPService();
