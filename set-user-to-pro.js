// Script to set user account to Pro tier
console.log('🔧 Setting user account to Pro tier...\n');

const setUserToPro = async () => {
  try {
    console.log('1. Checking current user authentication...');
    
    // First, get the current user to verify authentication
    const userResponse = await fetch('/api/auth/user');
    if (!userResponse.ok) {
      console.error('❌ Not authenticated. Please log in first.');
      return;
    }
    
    const user = await userResponse.json();
    console.log('   ✅ Authenticated as:', user.email || user.id);
    console.log('   ✅ Current tier:', user.subscriptionTier || 'free');
    
    if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'byok' || user.subscriptionTier === 'enterprise') {
      console.log('   ✅ User is already on Pro or higher tier');
      return;
    }
    
    console.log('2. Updating subscription to Pro tier...');
    
    const updateResponse = await fetch('/api/billing/subscription', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        tier: 'pro', 
        status: 'active' 
      }),
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error('❌ Failed to update subscription:', error);
      return;
    }
    
    const result = await updateResponse.json();
    console.log('   ✅ Successfully updated to Pro tier');
    console.log('   ✅ New tier:', result.tier);
    console.log('   ✅ Pro status:', result.isPro ? 'ACTIVE' : 'INACTIVE');
    
    console.log('3. Refreshing user data...');
    
    // Refresh the user data
    const refreshResponse = await fetch('/api/auth/user');
    if (refreshResponse.ok) {
      const updatedUser = await refreshResponse.json();
      console.log('   ✅ User data refreshed');
      console.log('   ✅ Confirmed tier:', updatedUser.subscriptionTier);
      console.log('   ✅ Pro features unlocked:', updatedUser.subscriptionTier === 'pro');
    }
    
    console.log('\n🎉 USER SUCCESSFULLY UPGRADED TO PRO!');
    console.log('✅ All Pro features are now unlocked');
    console.log('✅ ElevenLabs voices available');
    console.log('✅ Custom voice cloning available');
    console.log('✅ Unlimited daily banters');
    console.log('✅ Advanced customization options');
    
  } catch (error) {
    console.error('❌ Error setting user to Pro:', error);
  }
};

// Run the script
setUserToPro();
