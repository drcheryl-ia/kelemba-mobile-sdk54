/**
 * Hook — génération et partage du récépissé PDF d'un paiement COMPLETED.
 * Découplé du composant, testable indépendamment.
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { logger } from '@/utils/logger';
import type { PaymentReceiptData } from '@/types/payment';

export interface UsePaymentReceiptResult {
  isGeneratingPdf: boolean;
  isSharingPdf: boolean;
  handleSharePdf: () => Promise<void>;
  handleDownload: () => Promise<void>;
}

function buildReceiptHtml(r: PaymentReceiptData): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #1A1A2E; }
        .header { text-align: center; margin-bottom: 24px; }
        .logo   { color: #1A6B3C; font-size: 24px; font-weight: 800; }
        .title  { font-size: 18px; font-weight: 700; margin-top: 8px; }
        .card   { border: 1px solid #E5E7EB; border-radius: 12px;
                  padding: 20px; margin-bottom: 16px; }
        .row    { display: flex; justify-content: space-between;
                  padding: 6px 0; border-bottom: 1px solid #F3F4F6; }
        .label  { color: #6B7280; font-size: 14px; }
        .value  { font-weight: 600; font-size: 14px; }
        .total  { font-size: 20px; font-weight: 800; color: #1A6B3C; }
        .ref    { text-align: center; font-size: 12px; color: #9CA3AF;
                  margin-top: 24px; }
        .badge  { display: inline-block; background: #DCFCE7;
                  color: #15803D; padding: 4px 12px; border-radius: 20px;
                  font-weight: 700; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Kelemba Digital</div>
        <div class="title">Reçu de cotisation</div>
        <div class="badge">✓ Paiement confirmé</div>
      </div>
      <div class="card">
        <div class="row">
          <span class="label">Tontine</span>
          <span class="value">${escapeHtml(r.tontineName)}</span>
        </div>
        <div class="row">
          <span class="label">Cycle</span>
          <span class="value">${r.cycleNumber} / ${r.totalCycles}</span>
        </div>
        ${r.beneficiaryName ? `
        <div class="row">
          <span class="label">Bénéficiaire du tour</span>
          <span class="value">${escapeHtml(r.beneficiaryName)}</span>
        </div>` : ''}
        <div class="row">
          <span class="label">Payeur</span>
          <span class="value">${escapeHtml(r.payerName)} — ${escapeHtml(r.payerPhone)}</span>
        </div>
        <div class="row">
          <span class="label">Moyen de paiement</span>
          <span class="value">${r.method === 'ORANGE_MONEY' ? 'Orange Money' : r.method === 'TELECEL_MONEY' ? 'Telecel Money' : r.method === 'CASH' ? 'Espèces' : r.method}</span>
        </div>
        <div class="row">
          <span class="label">Montant de base</span>
          <span class="value">${r.baseAmount.toLocaleString('fr-FR')} FCFA</span>
        </div>
        ${r.penaltyAmount > 0 ? `
        <div class="row">
          <span class="label" style="color:#D0021B">Pénalités retard</span>
          <span class="value" style="color:#D0021B">+${r.penaltyAmount.toLocaleString('fr-FR')} FCFA</span>
        </div>` : ''}
        <div class="row" style="border-bottom:none; margin-top:8px">
          <span class="label" style="font-weight:700">TOTAL PAYÉ</span>
          <span class="total">${r.totalAmount.toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
      <div class="card">
        <div class="row">
          <span class="label">Date et heure</span>
          <span class="value">${new Date(r.paidAt).toLocaleString('fr-FR')}</span>
        </div>
        ${r.externalRef ? `
        <div class="row">
          <span class="label">Réf. opérateur</span>
          <span class="value">${escapeHtml(r.externalRef)}</span>
        </div>` : ''}
        <div class="row" style="border-bottom:none">
          <span class="label">Réf. Kelemba</span>
          <span class="value" style="font-size:12px">${escapeHtml(r.paymentUid)}</span>
        </div>
      </div>
      <div class="ref">
        Document généré par Kelemba Digital — NeXus Technology Inc.<br/>
        Ce reçu est une preuve de paiement officielle.
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function usePaymentReceipt(
  receipt: PaymentReceiptData
): UsePaymentReceiptResult {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  const generatePdfUri = useCallback(async (): Promise<string> => {
    const html = buildReceiptHtml(receipt);
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });
    const destUri = `${FileSystem.documentDirectory}recu_kelemba_${receipt.paymentUid.slice(0, 8)}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: destUri });
    return destUri;
  }, [receipt]);

  const handleSharePdf = useCallback(async (): Promise<void> => {
    setIsSharingPdf(true);
    try {
      const uri = await generatePdfUri();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reçu Kelemba — ${receipt.tontineName}`,
        });
      } else {
        Alert.alert(
          'Partage indisponible',
          'Le partage n\'est pas disponible sur cet appareil.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[PaymentReceipt] handleSharePdf failed', { message: msg });
      Alert.alert(
        'Erreur',
        'Impossible de partager le reçu. Réessayez plus tard.'
      );
    } finally {
      setIsSharingPdf(false);
    }
  }, [generatePdfUri, receipt.tontineName]);

  const handleDownload = useCallback(async (): Promise<void> => {
    setIsGeneratingPdf(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'L\'accès à la galerie est nécessaire pour enregistrer le reçu.'
        );
        return;
      }

      const uri = await generatePdfUri();
      const asset = await MediaLibrary.createAssetAsync(uri);
      const album = await MediaLibrary.getAlbumAsync('Kelemba');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('Kelemba', asset, false);
      }
      Alert.alert(
        'Reçu enregistré',
        'Le PDF a été ajouté à votre galerie (album Kelemba).'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[PaymentReceipt] handleDownload failed', { message: msg });
      Alert.alert('Erreur', 'Impossible de télécharger le reçu.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [generatePdfUri]);

  return {
    isGeneratingPdf,
    isSharingPdf,
    handleSharePdf,
    handleDownload,
  };
}
