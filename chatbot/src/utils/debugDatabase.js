import { supabase } from '@/lib/customSupabaseClient';

/**
 * Diagnostic utility to check database state for "Fiado" sales
 * accessible via window.debugDB() in the browser console.
 */
export const debugDatabase = async () => {
  console.group("🔍 DATABASE DIAGNOSTIC REPORT");
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log("👤 Current User:", user ? `${user.email} (${user.id})` : "No user logged in");

    if (!user) {
      console.warn("⚠️ Cannot run diagnostics without authenticated user.");
      console.groupEnd();
      return;
    }

    // 1. Check Vendas with 'fiado'
    console.log("--- CHECKING VENDAS (forma_pagamento = 'fiado') ---");
    const { data: vendasFiado, error: vendasError } = await supabase
      .from('vendas')
      .select('id, numero_venda, total, cliente_id, data_criacao, status')
      .eq('user_id', user.id)
      .eq('forma_pagamento', 'fiado') // Ensure lowercase match
      .limit(5);

    if (vendasError) {
      console.error("❌ Error fetching vendas:", vendasError.message);
    } else {
      console.log(`✅ Found ${vendasFiado.length} recent 'fiado' sales.`);
      if (vendasFiado.length > 0) {
        console.table(vendasFiado);
        
        // Check for orphaned records (vendas 'fiado' without contas_receber)
        const vendaIds = vendasFiado.map(v => v.id);
        const { data: contas, error: contasError } = await supabase
          .from('contas_receber')
          .select('venda_id')
          .in('venda_id', vendaIds);
          
        if (!contasError) {
          const linkedIds = contas.map(c => c.venda_id);
          const orphans = vendasFiado.filter(v => !linkedIds.includes(v.id));
          if (orphans.length > 0) {
            console.warn("⚠️ ORPHAN WARNING: The following vendas are 'fiado' but have NO entry in 'contas_receber':", orphans);
          } else {
            console.log("✅ All checked 'fiado' sales have corresponding 'contas_receber' entries.");
          }
        }
      } else {
        console.info("ℹ️ No 'fiado' sales found in 'vendas' table.");
      }
    }

    // 2. Check Contas a Receber
    console.log("--- CHECKING CONTAS_RECEBER ---");
    const { data: contasReceber, error: crError } = await supabase
      .from('contas_receber')
      .select('*')
      .eq('user_id', user.id)
      .limit(5);

    if (crError) {
      console.error("❌ Error fetching contas_receber:", crError.message);
    } else {
      console.log(`✅ Found ${contasReceber.length} entries in 'contas_receber'.`);
      if (contasReceber.length > 0) {
        console.table(contasReceber);
      } else {
        console.warn("⚠️ 'contas_receber' is empty. This explains why the page might be blank.");
      }
    }

    // 3. Check Clients
    console.log("--- CHECKING CLIENTS (Pessoas) ---");
    const { count: clientCount, error: clientError } = await supabase
      .from('pessoas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (clientError) {
      console.error("❌ Error counting clients:", clientError.message);
    } else {
      console.log(`ℹ️ Total clients found: ${clientCount}`);
    }

  } catch (err) {
    console.error("🔥 CRITICAL DIAGNOSTIC ERROR:", err);
  } finally {
    console.groupEnd();
  }
};

// Expose to window for easy access
if (typeof window !== 'undefined') {
  window.debugDB = debugDatabase;
  console.log("🛠️ debugDB() utility loaded. Type 'debugDB()' in console to run.");
}