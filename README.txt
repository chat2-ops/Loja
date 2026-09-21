PARTE SUPABASE — PIX DOMINIPAY

1. No Supabase, abra SQL Editor, cole o arquivo migration.sql e clique em Run.
2. Abra Edge Functions e crie uma função chamada create-dominipay-payment.
3. Cole o conteúdo de create-dominipay-payment/index.ts e publique/deploy.
4. Em Edge Functions > Secrets, crie DOMINIPAY_TOKEN com o token público da Dominipay.

O site do GitHub já chama essa função. O valor mínimo aceito pela Dominipay é R$ 5,00.
A atualização automática do pedido para aprovado será configurada depois; este pacote é o mínimo para gerar o QR Code Pix.
